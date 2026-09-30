import { prisma } from '@/lib/prisma';
import { requirePageRole } from '@/lib/session';
import { fmtDate } from '@/lib/dates';
import { APPARATUS, type Apparatus } from '@/lib/constants';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata = { title: 'Meus exercícios' };

export default async function ExerciciosPage() {
  const user = await requirePageRole('PATIENT');
  const prescriptions = await prisma.prescription.findMany({
    where: { patientId: user.patientId!, active: true },
    orderBy: { createdAt: 'desc' },
    include: { items: { orderBy: { order: 'asc' } } },
  });

  return (
    <>
      <PageHeader title="Meus exercícios" subtitle="Rotinas e orientações preparadas pela sua fisioterapeuta." />
      {prescriptions.length === 0 && <EmptyState>Nenhuma rotina disponível ainda.</EmptyState>}
      <div className="space-y-6">
        {prescriptions.map((p) => {
          const groups = new Map<string, typeof p.items>();
          for (const it of p.items) groups.set(it.apparatus, [...(groups.get(it.apparatus) ?? []), it]);
          return (
            <article key={p.id} className="card card-pad space-y-4">
              <div>
                <h2 className="text-2xl font-semibold">{p.title}</h2>
                <p className="text-sm text-mist-500">Atualizada em {fmtDate(p.updatedAt)}{p.frequency && ` · ${p.frequency}`}</p>
              </div>
              {p.homeGuidance && (
                <div className="rounded-xl border-l-4 border-copper-400 bg-sand-50 p-4 text-sm dark:bg-mist-800">
                  <p className="label">Orientações para casa</p>
                  <p className="whitespace-pre-line">{p.homeGuidance}</p>
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                {[...groups].map(([app, items]) => (
                  <div key={app} className="rounded-xl border border-sand-200 p-4 dark:border-mist-700">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-copper-600 dark:text-sand-300">{APPARATUS[app as Apparatus] ?? app}</p>
                    <ol className="space-y-3">
                      {items.map((it, i) => (
                        <li key={it.id} className="flex gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sand-100 text-xs font-semibold text-copper-700 dark:bg-mist-800 dark:text-sand-300">{i + 1}</span>
                          <div>
                            <p className="font-medium">{it.exerciseName}</p>
                            <p className="text-xs text-mist-500">{[it.sets && `${it.sets} série${it.sets > 1 ? "s" : ""}`, it.reps && `${it.reps} repetições`, it.load].filter(Boolean).join(' · ')}</p>
                            {it.notes && <p className="text-xs italic text-mist-500">{it.notes}</p>}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
