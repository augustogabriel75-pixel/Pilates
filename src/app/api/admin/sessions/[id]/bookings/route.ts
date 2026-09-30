import { handler, ok, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireApiRole } from '@/lib/session';
import { patientRefSchema } from '@/lib/validation';
import { bookPatient } from '@/lib/scheduling';
import { HttpError } from '@/lib/errors';

export const POST = handler<{ id: string }>(async (req, { params }) => {
  await requireApiRole('ADMIN');
  const { id } = await params;
  const { patientId } = await parseBody(req, patientRefSchema);
  await prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findUnique({ where: { id: patientId } });
    if (!patient?.active) throw new HttpError(404, 'Paciente não encontrado.');
    await bookPatient(tx, id, patientId);
  });
  return ok({ message: 'Paciente adicionado à aula.' }, 201);
});
