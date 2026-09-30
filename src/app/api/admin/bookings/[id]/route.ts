import { handler, ok, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireApiRole } from '@/lib/session';
import { adminBookingStatusSchema } from '@/lib/validation';
import { occupiedCount } from '@/lib/scheduling';
import { HttpError } from '@/lib/errors';
import { OCCUPYING_STATUSES, type BookingStatus } from '@/lib/constants';

/** Validação de presença pelo instrutor (Presente/Falta), cancelamento ou reabertura. */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  await requireApiRole('ADMIN');
  const { id } = await params;
  const { status } = await parseBody(req, adminBookingStatusSchema);
  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id }, include: { session: true } });
    if (!booking) throw new HttpError(404, 'Agendamento não encontrado.');
    const wasOccupying = OCCUPYING_STATUSES.includes(booking.status as BookingStatus);
    if (!wasOccupying && status !== 'CANCELLED') {
      if ((await occupiedCount(tx, booking.sessionId)) >= booking.session.capacity) {
        throw new HttpError(409, 'Aula lotada — não é possível reabrir este agendamento.');
      }
    }
    const now = new Date();
    await tx.booking.update({
      where: { id },
      data: {
        status,
        validatedAt: status === 'ATTENDED' || status === 'ABSENT' ? now : null,
        cancelledAt: status === 'CANCELLED' ? now : null,
      },
    });
  });
  return ok({ message: 'Status atualizado.' });
});
