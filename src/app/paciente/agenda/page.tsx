import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requirePageRole } from '@/lib/session';
import { fmtDate, fmtDayShort, fmtTime } from '@/lib/dates';
import { MAKEUP_VALID_DAYS, MIN_RESCHEDULE_HOURS } from '@/lib/constants';
import { bookingPermissions } from '@/lib/patient-bookings';
import { makeupExpiresAt } from '@/lib/reschedule';
import { BookingBadge, EmptyState, PageHeader } from '@/components/ui';
import { BookingActions } from '../BookingActions';

export const metadata = { title: 'Minha agenda' };

export default async function PatientAgenda() {
  const user = await requirePageRole('PATIENT');
  const patientId = user.patientId!;
  const now = new Date();

  const [upcoming, credits, history] = await Promise.all([
    prisma.booking.findMany({
      where: { patientId, status: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'] }, session: { endsAt: { gte: now } } },
      include: { session: true },
      orderBy: { session: { startsAt: 'asc' } },
      take: 40,
    }),
    prisma.booking.findMany({
      where: { patientId, status: 'CANCELLED', makeupAvailable: true, rescheduledTo: null, cancelledAt: { gte: new Date(now.getTime() - MAKEUP_VALID_DAYS * 864e5) } },
      include: { session: true },
      orderBy: { cancelledAt: 'asc' },
    }),
    prisma.booking.findMany({
      where: { patientId, session: { endsAt: { lt: now } } },
      include: { session: true },
      orderBy: { session: { startsAt: 'desc' } },
      take: 50,
    }),
  ]);

  const attended = history.filter((b) => b.status === 'ATTENDED' || b.status === 'CHECKED_IN').length;
  const absent = history.filter((b) => b.status === 'ABSENT').length;

  return (
    <>
      <PageHeader title="Minha agenda" subtitle={`Cancelamentos e reagendamentos com pelo menos ${MIN_RESCHEDULE_HOURS}h de antecedência geram direito a reposição (válida por ${MAKEUP_VALID_DAYS} dias).`} />

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold">Próximas aulas</h2>
        {upcoming.length === 0 ? (
          <EmptyState>Nenhuma aula agendada.</EmptyState>
        ) : (
          <ul className="card">
            {upcoming.map((b) => (
              <li key={b.id} className="flex flex-col gap-2 border-t border-sand-100 p-4 first:border-t-0 dark:border-mist-800 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{fmtDayShort(b.session.startsAt)} · {fmtTime(b.session.startsAt)}</p>
                  <p className="text-sm text-mist-500">
                    {b.session.title} <BookingBadge status={b.status} />
                    {b.isMakeup && <span className="badge ml-1 bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">Reposição</span>}
                  </p>
                </div>
                <BookingActions bookingId={b.id} {...bookingPermissions(b, now)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="reposicoes" className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold">Créditos de reposição</h2>
        {credits.length === 0 ? (
          <EmptyState>Você não possui créditos de reposição.</EmptyState>
        ) : (
          <ul className="card">
            {credits.map((b) => (
              <li key={b.id} className="flex flex-col gap-2 border-t border-sand-100 p-4 first:border-t-0 dark:border-mist-800 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">Aula cancelada de {fmtDate(b.session.startsAt)} · {fmtTime(b.session.startsAt)}</p>
                  <p className="text-xs text-mist-500">Válido até {fmtDate(makeupExpiresAt(b))}</p>
                </div>
                <Link href={`/paciente/reagendar?from=${b.id}`} className="btn-primary btn-sm">Agendar reposição</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-semibold">Histórico</h2>
          <p className="text-sm text-mist-500">{attended} presenças · {absent} faltas</p>
        </div>
        {history.length === 0 ? (
          <EmptyState>Seu histórico aparecerá aqui.</EmptyState>
        ) : (
          <ul className="card">
            {history.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 border-t border-sand-100 px-4 py-3 text-sm first:border-t-0 dark:border-mist-800">
                <span>{fmtDayShort(b.session.startsAt)} · {fmtTime(b.session.startsAt)} — {b.session.title}</span>
                <BookingBadge status={b.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
