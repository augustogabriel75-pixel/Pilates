import { handler, ok, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requirePatient } from '@/lib/session';
import { rescheduleSchema } from '@/lib/validation';
import { assertReschedulable } from '@/lib/reschedule';
import { bookPatient } from '@/lib/scheduling';
import { HttpError } from '@/lib/errors';

/**
 * Reagendamento / reposição: move um agendamento futuro (com antecedência mínima)
 * ou usa um crédito de reposição para ocupar uma vaga livre em outra aula.
 */
export const POST = handler(async (req) => {
  const user = await requirePatient();
  const { fromBookingId, toSessionId } = await parseBody(req, rescheduleSchema);

  await prisma.$transaction(async (tx) => {
    const from = await tx.booking.findUnique({ where: { id: fromBookingId }, include: { session: true, rescheduledTo: true } });
    if (!from || from.patientId !== user.patientId) throw new HttpError(404, 'Agendamento não encontrado.');
    assertReschedulable(from);
    if (from.sessionId === toSessionId) throw new HttpError(400, 'Escolha um horário diferente.');

    const target = await tx.session.findUnique({ where: { id: toSessionId } });
    if (!target || target.status !== 'SCHEDULED' || target.startsAt <= new Date()) {
      throw new HttpError(409, 'Horário indisponível.');
    }
    if (target.modality !== from.session.modality) throw new HttpError(409, 'Escolha um horário da mesma modalidade.');

    if (from.status === 'CANCELLED') {
      await tx.booking.update({ where: { id: from.id }, data: { makeupAvailable: false } });
    } else {
      await tx.booking.update({ where: { id: from.id }, data: { status: 'RESCHEDULED', cancelledAt: new Date() } });
    }
    await bookPatient(tx, toSessionId, user.patientId, { isMakeup: true, rescheduledFromId: from.id });
  });

  return ok({ message: 'Aula reagendada com sucesso!' });
});
