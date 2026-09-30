import { prisma } from '@/lib/prisma';
import { requirePageRole } from '@/lib/session';
import { parseWeekdays } from '@/lib/scheduling';
import { fmtDate, todayStr } from '@/lib/dates';
import { EmptyState, PageHeader } from '@/components/ui';
import { NewClassForm } from './NewClassForm';
import { ClassCard } from './ClassCard';

export const metadata = { title: 'Turmas' };

export default async function TurmasPage() {
  await requirePageRole('ADMIN');
  const [groups, patients] = await Promise.all([
    prisma.classGroup.findMany({
      where: { active: true },
      orderBy: [{ startTime: 'asc' }, { name: 'asc' }],
      include: {
        enrollments: { include: { patient: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'asc' } },
        sessions: { orderBy: { startsAt: 'desc' }, take: 1, select: { startsAt: true } },
      },
    }),
    prisma.patient.findMany({ where: { active: true }, select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } }),
  ]);

  return (
    <>
      <PageHeader title="Turmas recorrentes" subtitle="Horários fixos (ex: Pilates 2x/semana) com limite de alunos. As aulas são geradas automaticamente na agenda." />
      <NewClassForm patients={patients} today={todayStr()} />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {groups.length === 0 && <EmptyState>Nenhuma turma cadastrada.</EmptyState>}
        {groups.map((g) => (
          <ClassCard
            key={g.id}
            group={{
              id: g.id, name: g.name, modality: g.modality, weekdays: parseWeekdays(g.weekdays), startTime: g.startTime,
              durationMin: g.durationMin, capacity: g.capacity, instructor: g.instructor,
              lastSession: g.sessions[0] ? fmtDate(g.sessions[0].startsAt) : null,
              enrolled: g.enrollments.map((e) => ({ id: e.patient.id, fullName: e.patient.fullName })),
            }}
            patients={patients}
          />
        ))}
      </div>
    </>
  );
}
