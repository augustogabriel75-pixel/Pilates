import { handler, ok, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireApiRole } from '@/lib/session';
import { prescriptionSchema } from '@/lib/validation';

export const POST = handler<{ id: string }>(async (req, { params }) => {
  await requireApiRole('ADMIN');
  const { id } = await params;
  const { items, ...data } = await parseBody(req, prescriptionSchema);
  await prisma.patient.findUniqueOrThrow({ where: { id }, select: { id: true } });
  await prisma.prescription.create({
    data: {
      ...data,
      patientId: id,
      items: { create: items.map((item, order) => ({ ...item, order })) },
    },
  });
  return ok({ message: 'Prescrição salva e disponível no portal do paciente.' }, 201);
});
