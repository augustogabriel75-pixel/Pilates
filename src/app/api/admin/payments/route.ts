import { handler, ok, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireApiRole } from '@/lib/session';
import { paymentUpsertSchema } from '@/lib/validation';
import { dueDateFor } from '@/lib/payments';
import { HttpError } from '@/lib/errors';

/** Registra/alterna manualmente o status da mensalidade de um paciente em um mês. */
export const PUT = handler(async (req) => {
  await requireApiRole('ADMIN');
  const { patientId, year, month, status, amount, method, notes } = await parseBody(req, paymentUpsertSchema);
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new HttpError(404, 'Paciente não encontrado.');
  const paidAt = status === 'PAID' ? new Date() : null;
  await prisma.payment.upsert({
    where: { patientId_year_month: { patientId, year, month } },
    create: {
      patientId, year, month, status, paidAt, method, notes,
      amount: amount ?? patient.monthlyFee,
      dueDate: dueDateFor(year, month, patient.dueDay),
    },
    update: {
      status, paidAt,
      ...(amount !== undefined ? { amount } : {}),
      ...(method !== null ? { method } : {}),
      ...(notes !== null ? { notes } : {}),
    },
  });
  return ok({ message: 'Pagamento atualizado.' });
});
