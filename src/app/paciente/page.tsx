import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requirePageRole } from '@/lib/session';
import { addDays, dayRange, fmtDateLong, fmtDayShort, fmtTime, studioDate, todayStr } from '@/lib/dates';
import { MAKEUP_VALID_DAYS, MODALITIES, OCCUPYING_STATUSES, type Modality } from '@/lib/constants';
import { bookingPermissions } from '@/lib/patient-bookings';
import { BookingBadge, EmptyState, PageHeader, StatCard } from '@/components/ui';
import { BookingActions } from './BookingActions';

export const metadata = { title: 'Início' };

export default async function PatientHome() {
  const user = await requirePageRole('PATIENT');
  const patientId = user.patientId!;
  const today = todayStr();
  const { start, end } = dayRange(today);
  const now = new Date();

  const [todays, upcoming, credits, monthAttended] = await Promise.all([
    prisma.booking.findMany({
      where: { patientId, status: { in: OCCUPYING_STATUSES }, session: { startsAt: { gte: start, lt: end }, status: 'SCHEDULED' } },
      include: { session: true },
      orderBy: { session: { startsAt: 'asc' } },
    }),
    prisma.booking.findMany({
      where: { patientId, status: { in: ['SCHEDULED', 'CONFIRMED'] }, session: { startsAt: { gte: end, lt: studioDate(addDays(today, 8)) }, status: 'SCHEDULED' } },
      include: { session: true },
      orderBy: { session: { startsAt: 'asc' } },
    }),
    prisma.booking.count({
      where: { patientId, status: 'CANCELLED', makeupAvailable: true, rescheduledTo: null, cancelledAt: { gte: new Date(now.getTime() - MAKEUP_VALID_DAYS * 864e5) } },
    }),
    prisma.booking.count({
      where: { patientId, status: { in: ['ATTENDED', 'CHECKED_IN'] }, session: { startsAt: { gte: studioDate(`${today.slice(0, 7)}-01`), lt: now } } },
    }),
  ]);
  const firstName = user.name.split(' ')[0];

  return (
    <>
      <PageHeader title={`Olá, ${firstName}!`} subtitle={<span>{fmtDateLong(today)}</span>} />

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold">Ponto do aluno — hoje</h2>
        {todays.length === 0 ? (
          <EmptyState>Você não tem aulas hoje. Aproveite para fazer seus exercícios de casa! 🌿</EmptyState>
        ) : (
          <div className="space-y-3">
            {todays.map((b) => (
              <div key={b.id} className="card card-pad flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-serif text-4xl font-semibold text-copper-600 dark:text-sand-300">{fmtTime(b.session.startsAt)}</p>
                  <p className="font-medium">{b.session.title}</p>
                  <p className="text-xs text-mist-500">{MODALITIES[b.session.modality as Modality]}</p>
                  <div className="mt-2"><BookingBadge status={b.status} /></div>
                </div>
                {['SCHEDULED', 'CONFIRMED'].includes(b.status) ? (
                  <div className="text-right">
                    <BookingActions bookingId={b.id} {...bookingPermissions(b, now)} canConfirm={false} canReschedule={false} />
                    {!bookingPermissions(b, now).canCheckin && b.session.startsAt > now && (
                      <p className="mt-1 text-xs text-mist-500">O check-in abre 2h antes da aula.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    {b.checkedInAt ? `Check-in às ${fmtTime(b.checkedInAt)} ✓` : 'Presença registrada ✓'}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Aulas no mês" value={monthAttended} hint="presenças registradas" />
        <StatCard label="Próximos 7 dias" value={upcoming.length} hint="aulas agendadas" />
        <Link href="/paciente/agenda#reposicoes" className="col-span-2 sm:col-span-1">
          <StatCard label="Reposições" value={credits} hint={credits ? 'toque para agendar' : 'nenhum crédito'} tone={credits ? 'warn' : 'default'} />
        </Link>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Próximas aulas</h2>
          <Link href="/paciente/agenda" className="btn-secondary btn-sm">Ver agenda completa</Link>
        </div>
        {upcoming.length === 0 ? (
          <EmptyState>Nenhuma aula nos próximos dias.</EmptyState>
        ) : (
          <ul className="card">
            {upcoming.map((b) => (
              <li key={b.id} className="flex flex-col gap-2 border-t border-sand-100 p-4 first:border-t-0 dark:border-mist-800 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{fmtDayShort(b.session.startsAt)} · {fmtTime(b.session.startsAt)}</p>
                  <p className="text-sm text-mist-500">{b.session.title} <BookingBadge status={b.status} /></p>
                </div>
                <BookingActions bookingId={b.id} {...bookingPermissions(b, now)} canCancel={false} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
