import type { Payment } from '@prisma/client';
import type { PaymentStatus } from './constants';
import { pad2, studioDate, addDays, toDateStr } from './dates';

export function dueDateFor(year: number, month: number, dueDay: number): Date {
  return studioDate(`${year}-${pad2(month)}-${pad2(Math.min(dueDay, 28))}`, '00:00');
}

/**
 * Status efetivo da mensalidade: um pagamento "Pendente" cujo vencimento já passou
 * é exibido como "Atrasado" automaticamente. Status registrado manualmente prevalece
 * quando for Pago ou Atrasado.
 */
export function effectiveStatus(
  payment: Pick<Payment, 'status' | 'dueDate'> | null | undefined,
  year: number,
  month: number,
  dueDay: number,
  now = new Date(),
): PaymentStatus {
  if (payment?.status === 'PAID') return 'PAID';
  if (payment?.status === 'LATE') return 'LATE';
  const due = payment?.dueDate ?? dueDateFor(year, month, dueDay);
  const endOfDue = studioDate(addDays(toDateStr(due), 1));
  return now >= endOfDue ? 'LATE' : 'PENDING';
}
