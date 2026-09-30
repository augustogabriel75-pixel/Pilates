import { handler, ok, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requirePatient } from '@/lib/session';
import { patientBookingActionSchema } from '@/lib/validation';
import { CHECKIN_OPENS_HOURS_BEFORE, MIN_RESCHEDULE_HOURS } from '@/lib/constants';
import { hoursUntil, toDateStr, todayStr } from '@/lib/dates';
import { HttpError } from '@/lib/errors';

/** Ações do paciente sobre os próprios agendamentos: check-in, confirmação e cancelamento. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePatient();
  const { id } = await params;
  const { action } = await parseBody(req, patientBookingActionSchema);

  const booking = await prisma.booking.findUnique({ where: { id }, include: { session: true } });
  // Não revela a existência de agendamentos de outros pacientes.
  if (!booking || booking.patientId !== user.patientId) throw new HttpError(404, 'Agendamento não encontrado.');
  if (booking.session.status !== 'SCHEDULED') throw new HttpError(409, 'Esta aula foi cancelada pelo estúdio.');

  const now = new Date();
  const { startsAt } = booking.session;

  if (action === 'checkin') {
    if (!['SCHEDULED', 'CONFIRMED'].includes(booking.status)) throw new HttpError(409, 'Check-in não disponível para este agendamento.');
    if (toDateStr(startsAt) !== todayStr()) throw new HttpError(409, 'O check-in só pode ser feito no dia da aula.');
    if (hoursUntil(startsAt, now) > CHECKIN_OPENS_HOURS_BEFORE) {
      throw new HttpError(409, `O check-in abre ${CHECKIN_OPENS_HOURS_BEFORE}h antes do início da aula.`);
    }
    await prisma.booking.update({ where: { id }, data: { status: 'CHECKED_IN', checkedInAt: now } });
    return ok({ message: 'Presença registrada! Bom treino. 🌿' });
  }

  if (startsAt <= now) throw new HttpError(409, 'Esta aula já começou.');

  if (action === 'confirm') {
    if (booking.status !== 'SCHEDULED') throw new HttpError(409, 'Agendamento já confirmado ou indisponível.');
    await prisma.booking.update({ where: { id }, data: { status: 'CONFIRMED', confirmedAt: now } });
    return ok({ message: 'Presença confirmada.' });
  }

  // cancel
  if (!['SCHEDULED', 'CONFIRMED'].includes(booking.status)) throw new HttpError(409, 'Este agendamento não pode ser cancelado.');
  const withNotice = hoursUntil(startsAt, now) >= MIN_RESCHEDULE_HOURS;
  await prisma.booking.update({
    where: { id },
    data: { status: 'CANCELLED', cancelledAt: now, makeupAvailable: withNotice },
  });
  return ok({
    message: withNotice
      ? 'Aula cancelada. Você ganhou um crédito de reposição.'
      : `Aula cancelada com menos de ${MIN_RESCHEDULE_HOURS}h de antecedência (sem direito a reposição).`,
  });
});
