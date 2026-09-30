import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requirePageRole } from '@/lib/session';
import { addDays, fmtDateLong, fmtDayShort, fmtTime, studioDate, toDateStr, todayStr } from '@/lib/dates';
import { MODALITIES, OCCUPYING_STATUSES, RESCHEDULE_WINDOW_DAYS, type Modality } from '@/lib/constants';
import { reschedulableReason } from '@/lib/reschedule';
import { idSchema } from '@/lib/validation';
import { EmptyState, PageHeader } from '@/components/ui';
import { RescheduleButton } from './RescheduleButton';

export const metadata = { title: 'Reagendar' };

export default async function ReagendarPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const user = await requirePageRole('PATIENT');
  const patientId = user.patientId!;
  const { from } = await searchParams;
  const parsed = idSchema.safeParse(from);

  const booking = parsed.success
    ? await prisma.booking.findFirst({ where: { id: parsed.data, patientId }, include: { session: true, rescheduledTo: true } })
    : null;
  const reason = booking ? reschedulableReason(booking) : 'Agendamento não encontrado.';

  const back = <Link href="/paciente/agenda" className="btn-ghost btn-sm mb-2 -ml-2"><ChevronLeft size={16} /> Minha agenda</Link>;
  if (!booking || reason) {
    return (
      <>
        {back}
        <PageHeader title="Reagendar aula" />
        <EmptyState>{reason}</EmptyState>
      </>
    );
  }

  // Horários com vaga, apenas do mesmo tipo de modalidade, onde o paciente ainda não está agendado.
  const now = new Date();
  const sessions = await prisma.session.findMany({
    where: {
      status: 'SCHEDULED',
      modality: booking.session.modality,
      id: { not: booking.sessionId },
      startsAt: { gt: new Date(now.getTime() + 60 * 60 * 1000), lt: studioDate(addDays(todayStr(), RESCHEDULE_WINDOW_DAYS)) },
      bookings: { none: { patientId, status: { in: OCCUPYING_STATUSES } } },
    },
    orderBy: { startsAt: 'asc' },
    include: { _count: { select: { bookings: { where: { status: { in: OCCUPYING_STATUSES } } } } } },
  });
  const available = sessions.filter((s) => s._count.bookings < s.capacity);
  const byDay = new Map<string, typeof available>();
  for (const s of available) {
    const k = toDateStr(s.startsAt);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  const isCredit = booking.status === 'CANCELLED';

  return (
    <>
      {back}
      <PageHeader
        title={isCredit ? 'Agendar reposição' : 'Reagendar aula'}
        subtitle={
          <>
            {isCredit ? 'Crédito da aula de ' : 'Aula atual: '}
            <strong>{fmtDayShort(booking.session.startsAt)} às {fmtTime(booking.session.startsAt)}</strong> ({booking.session.title}).
            Escolha um horário com vaga nos próximos {RESCHEDULE_WINDOW_DAYS} dias.
          </>
        }
      />
      {available.length === 0 ? (
        <EmptyState>Não há horários com vagas disponíveis no momento. Tente novamente mais tarde ou fale com o estúdio.</EmptyState>
      ) : (
        <div className="space-y-5">
          {[...byDay].map(([day, list]) => (
            <section key={day}>
              <h2 className="mb-2 text-lg font-semibold">{fmtDateLong(day)}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((s) => (
                  <div key={s.id} className="card card-pad flex items-center justify-between gap-3">
                    <div>
                      <p className="font-serif text-2xl font-semibold text-copper-600 dark:text-sand-300">{fmtTime(s.startsAt)}</p>
                      <p className="text-sm">{s.title}</p>
                      <p className="text-xs text-mist-500">
                        {MODALITIES[s.modality as Modality]} · {s.capacity - s._count.bookings} vaga(s)
                      </p>
                    </div>
                    <RescheduleButton fromBookingId={booking.id} toSessionId={s.id} label={`${fmtDayShort(s.startsAt)} às ${fmtTime(s.startsAt)}`} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
