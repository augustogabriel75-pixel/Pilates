import { handler, ok, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireApiRole } from '@/lib/session';
import { sessionUpdateSchema } from '@/lib/validation';
import { occupiedCount } from '@/lib/scheduling';
import { HttpError } from '@/lib/errors';

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  await requireApiRole('ADMIN');
  const { id } = await params;
  const body = await parseBody(req, sessionUpdateSchema);

  const message = await prisma.$transaction(async (tx) => {
    const session = await tx.session.findUnique({ where: { id } });
    if (!session) throw new HttpError(404, 'Aula não encontrada.');
    const now = new Date();

    if (body.capacity !== undefined) {
      const used = await occupiedCount(tx, id);
      if (body.capacity < used) throw new HttpError(400, `Já existem ${used} alunos agendados nesta aula.`);
      await tx.session.update({ where: { id }, data: { capacity: body.capacity } });
    }
    if (body.notes !== undefined) await tx.session.update({ where: { id }, data: { notes: body.notes } });

    if (body.status === 'CANCELLED' && session.status !== 'CANCELLED') {
      await tx.session.update({ where: { id }, data: { status: 'CANCELLED' } });
      // Cancelamento pelo estúdio sempre gera direito a reposição.
      await tx.booking.updateMany({
        where: { sessionId: id, status: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'] } },
        data: { status: 'CANCELLED', cancelledAt: now, makeupAvailable: true },
      });
      return 'Aula cancelada. Os alunos receberam crédito de reposição.';
    }
    if (body.status === 'SCHEDULED' && session.status === 'CANCELLED') {
      await tx.session.update({ where: { id }, data: { status: 'SCHEDULED' } });
      return 'Aula reativada. Reagende os alunos manualmente, se necessário.';
    }
    if (body.markAll === 'ATTENDED') {
      const r = await tx.booking.updateMany({
        where: { sessionId: id, status: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'] } },
        data: { status: 'ATTENDED', validatedAt: now },
      });
      return `${r.count} presença(s) validada(s).`;
    }
    return 'Aula atualizada.';
  });
  return ok({ message });
});
