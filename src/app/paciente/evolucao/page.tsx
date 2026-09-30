import { prisma } from '@/lib/prisma';
import { requirePageRole } from '@/lib/session';
import { fmtDate } from '@/lib/dates';
import { EmptyState, PageHeader, StatCard } from '@/components/ui';

export const metadata = { title: 'Minha evolução' };

export default async function EvolucaoPage() {
  const user = await requirePageRole('PATIENT');
  const patientId = user.patientId!;
  const now = new Date();
  // Somente campos liberados ao paciente — anotações clínicas internas não são expostas.
  const [records, attended, absent] = await Promise.all([
    prisma.evolutionRecord.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
      take: 30,
      select: { id: true, date: true, painLevel: true, patientGuidance: true },
    }),
    prisma.booking.count({ where: { patientId, status: { in: ['ATTENDED', 'CHECKED_IN'] }, session: { startsAt: { lt: now } } } }),
    prisma.booking.count({ where: { patientId, status: 'ABSENT' } }),
  ]);
  const frequency = attended + absent ? Math.round((attended / (attended + absent)) * 100) : null;
  const pain = records.filter((r) => r.painLevel !== null).slice(0, 10).reverse();
  const guidance = records.filter((r) => r.patientGuidance);

  return (
    <>
      <PageHeader title="Minha evolução" subtitle="Acompanhe sua frequência, dor relatada e as orientações recebidas." />
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Aulas realizadas" value={attended} />
        <StatCard label="Faltas" value={absent} />
        <StatCard label="Frequência" value={frequency === null ? '—' : `${frequency}%`} tone={frequency !== null && frequency >= 80 ? 'good' : 'default'} />
      </div>

      {pain.length > 0 && (
        <section className="card card-pad mb-8">
          <h2 className="mb-4 text-2xl font-semibold">Escala de dor (0–10)</h2>
          <div className="flex h-40 items-end gap-2">
            {pain.map((r) => (
              <div key={r.id} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-semibold">{r.painLevel}</span>
                <div
                  className="w-full max-w-[40px] rounded-t-lg"
                  style={{ height: `${Math.max(4, (r.painLevel ?? 0) * 10)}%`, background: (r.painLevel ?? 0) >= 7 ? '#dc2626' : (r.painLevel ?? 0) >= 4 ? '#c9a97a' : '#059669' }}
                />
                <span className="text-[10px] text-mist-500">{fmtDate(r.date).slice(0, 5)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-2xl font-semibold">Orientações da fisioterapeuta</h2>
        {guidance.length === 0 ? (
          <EmptyState>Nenhuma orientação registrada ainda.</EmptyState>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-sand-200 pl-6 dark:border-mist-700">
            {guidance.map((r) => (
              <li key={r.id} className="relative">
                <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full bg-copper-400 ring-4 ring-sand-50 dark:ring-mist-950" />
                <p className="text-xs font-semibold uppercase tracking-wide text-mist-500">{fmtDate(r.date)}</p>
                <p className="card card-pad mt-1 whitespace-pre-line text-sm">{r.patientGuidance}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
