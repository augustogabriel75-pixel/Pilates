import { handler, ok, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireApiRole } from '@/lib/session';
import { sessionCreateSchema } from '@/lib/validation';
import { studioDate } from '@/lib/dates';
import { HttpError } from '@/lib/errors';

/** Cria uma aula avulsa (ex: avaliação, sessão de fisioterapia individual). */
export const POST = handler(async (req) => {
  await requireApiRole('ADMIN');
  const { date, startTime, durationMin, patientIds, ...data } = await parseBody(req, sessionCreateSchema);
  const unique = [...new Set(patientIds)];
  if (unique.length > data.capacity) throw new HttpError(400, 'Mais pacientes do que vagas.');
  const startsAt = studioDate(date, startTime);
  const session = await prisma.$transaction(async (tx) => {
    const found = await tx.patient.count({ where: { id: { in: unique }, active: true } });
    if (found !== unique.length) throw new HttpError(400, 'Paciente inválido na seleção.');
    return tx.session.create({
      data: {
        ...data,
        startsAt,
        endsAt: new Date(startsAt.getTime() + durationMin * 60_000),
        bookings: { create: unique.map((patientId) => ({ patientId })) },
      },
    });
  });
  return ok({ id: session.id, message: 'Aula criada.' }, 201);
});
