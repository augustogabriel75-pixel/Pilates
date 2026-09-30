import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requirePageRole } from '@/lib/session';
import { dayRange, fmtDateLong, fmtTime, todayStr } from '@/lib/dates';
import { MODALITIES, OCCUPYING_STATUSES, type Modality } from '@/lib/constants';
import { effectiveStatus } from '@/lib/payments';
import { brl } from '@/lib/format';
import { EmptyState, PageHeader, StatCard } from '@/components/ui';

export const metadata = { title: 'Painel' };

export default async function AdminHome() {
  const user = await requirePageRole('ADMIN');
  const today = todayStr();
  const { start, end } = dayRange(today);
  const [year, month] = today.split('-').map(Number) as [number, number];

  const [sessions, activePatients, patients] = await Promise.all([
    prisma.session.findMany({
      where: { startsAt: { gte: start, lt: end }, status: 'SCHEDULED' },
      orderBy: { startsAt: 'asc' },
      include: { bookings: { where: { status: { in: OCCUPYING_STATUSES } }, select: { status: true } } },
    }),
    prisma.patient.count({ where: { active: true } }),
    prisma.patient.findMany({
      where: { active: true },
      select: { dueDay: true, monthlyFee: true, payments: { where: { year, month } } },
    }),
  ]);

  let received = 0, pendingCount = 0, lateCount = 0, openAmount = 0;
  for (const p of patients) {
    const pay = p.payments[0];
    const st = effectiveStatus(pay, year, month, p.dueDay);
    if (st === 'PAID') received += pay?.amount ?? p.monthlyFee;
    else {
      openAmount += pay?.amount ?? p.monthlyFee;
      if (st === 'LATE') lateCount++;
      else pendingCount++;
    }
  }

  const bookingsToday = sessions.flatMap((s) => s.bookings);
  const validated = bookingsToday.filter((b) => b.status === 'ATTENDED' || b.status === 'ABSENT').length;
  const checkins = bookingsToday.filter((b) => b.status === 'CHECKED_IN').length;
  const firstName = user.name.split(' ')[0];

  return (
    <>
      <PageHeader title={`Olá, ${firstName}`} subtitle={<span>{fmtDateLong(today)}</span>} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Aulas hoje" value={sessions.length} hint={`${bookingsToday.length} alunos agendados`} />
        <StatCard label="Check-ins" value={checkins} hint={`${validated} presenças validadas`} tone="warn" />
        <StatCard label="Recebido no mês" value={brl(received)} hint={`${brl(openAmount)} em aberto`} tone="good" />
        <StatCard label="Atrasados" value={lateCount} hint={`${pendingCount} pendentes · ${activePatients} pacientes ativos`} tone={lateCount ? 'bad' : 'default'} />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Aulas de hoje</h2>
          <Link href="/admin/presenca" className="btn-secondary btn-sm">Validar presenças</Link>
        </div>
        {sessions.length === 0 ? (
          <EmptyState>Nenhuma aula agendada para hoje.</EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => {
              const pct = Math.min(100, Math.round((s.bookings.length / s.capacity) * 100));
              return (
                <Link key={s.id} href={`/admin/agenda/sessao/${s.id}`} className="card card-pad transition hover:-translate-y-0.5">
                  <p className="font-serif text-2xl font-semibold text-copper-600 dark:text-sand-300">{fmtTime(s.startsAt)}</p>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs text-mist-500">{MODALITIES[s.modality as Modality] ?? s.modality}</p>
                  <div className="mt-3 h-1.5 rounded-full bg-sand-100 dark:bg-mist-800">
                    <div className="h-1.5 rounded-full bg-copper-400" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-mist-500">{s.bookings.length}/{s.capacity} vagas ocupadas</p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <Link href="/admin/pacientes/novo" className="card card-pad hover:border-copper-300">
          <p className="font-semibold">+ Novo paciente</p>
          <p className="text-sm text-mist-500">Cadastro completo e acesso ao portal.</p>
        </Link>
        <Link href="/admin/turmas" className="card card-pad hover:border-copper-300">
          <p className="font-semibold">+ Nova turma recorrente</p>
          <p className="text-sm text-mist-500">Ex: Pilates 2x/semana com limite de alunos.</p>
        </Link>
        <Link href="/admin/financeiro" className="card card-pad hover:border-copper-300">
          <p className="font-semibold">Mensalidades</p>
          <p className="text-sm text-mist-500">Status de pagamento do mês.</p>
        </Link>
      </section>
    </>
  );
}
