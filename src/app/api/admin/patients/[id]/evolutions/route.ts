import { handler, ok, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireApiRole } from '@/lib/session';
import { evolutionSchema } from '@/lib/validation';
import { studioDate } from '@/lib/dates';

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireApiRole('ADMIN');
  const { id } = await params;
  const { date, ...data } = await parseBody(req, evolutionSchema);
  await prisma.patient.findUniqueOrThrow({ where: { id }, select: { id: true } });
  await prisma.evolutionRecord.create({
    data: { ...data, date: studioDate(date, '12:00'), patientId: id, authorId: user.id },
  });
  return ok({ message: 'Evolução registrada.' }, 201);
});
