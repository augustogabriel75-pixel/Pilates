import { handler, ok } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireApiRole } from '@/lib/session';

export const DELETE = handler<{ id: string }>(async (_req, { params }) => {
  await requireApiRole('ADMIN');
  const { id } = await params;
  await prisma.evolutionRecord.delete({ where: { id } });
  return ok({ message: 'Registro removido.' });
});
