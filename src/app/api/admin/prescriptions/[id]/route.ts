import { handler, ok, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireApiRole } from '@/lib/session';
import { prescriptionUpdateSchema } from '@/lib/validation';

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  await requireApiRole('ADMIN');
  const { id } = await params;
  const { active } = await parseBody(req, prescriptionUpdateSchema);
  await prisma.prescription.update({ where: { id }, data: { active } });
  return ok({ message: active ? 'Prescrição reativada.' : 'Prescrição arquivada.' });
});

export const DELETE = handler<{ id: string }>(async (_req, { params }) => {
  await requireApiRole('ADMIN');
  const { id } = await params;
  await prisma.prescription.delete({ where: { id } });
  return ok({ message: 'Prescrição excluída.' });
});
