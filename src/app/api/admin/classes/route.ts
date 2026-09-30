import { handler, ok, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireApiRole } from '@/lib/session';
import { classGroupSchema } from '@/lib/validation';
import { studioDate, todayStr } from '@/lib/dates';
import { generateSessions } from '@/lib/scheduling';
import { HttpError } from '@/lib/errors';

export const POST = handler(async (req) => {
  await requireApiRole('ADMIN');
  const { weeks, patientIds, weekdays, startDate, ...data } = await parseBody(req, classGroupSchema);
  const uniquePatients = [...new Set(patientIds)];
  if (uniquePatients.length > data.capacity) {
    throw new HttpError(400, `A turma comporta ${data.capacity} aluno(s), mas ${uniquePatients.length} foram selecionados.`);
  }
  const from = startDate < todayStr() ? todayStr() : startDate;

  const result = await prisma.$transaction(async (tx) => {
    const found = await tx.patient.count({ where: { id: { in: uniquePatients }, active: true } });
    if (found !== uniquePatients.length) throw new HttpError(400, 'Paciente inválido na seleção.');
    const group = await tx.classGroup.create({
      data: {
        ...data,
        weekdays: [...new Set(weekdays)].sort().join(','),
        startDate: studioDate(from),
        enrollments: { create: uniquePatients.map((patientId) => ({ patientId })) },
      },
    });
    const created = await generateSessions(tx, group.id, from, weeks);
    return { id: group.id, created };
  }, { timeout: 30_000 });

  return ok({ id: result.id, message: `Turma criada com ${result.created} aula(s) na agenda.` }, 201);
});
