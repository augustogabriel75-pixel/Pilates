import type { Booking, Session } from '@prisma/client';
import { MAKEUP_VALID_DAYS, MIN_RESCHEDULE_HOURS } from './constants';
import { hoursUntil } from './dates';
import { HttpError } from './errors';

type B = Booking & { session: Session; rescheduledTo?: Booking | null };

/** Um agendamento pode ser reagendado se for futuro (com antecedência) ou um crédito de reposição válido. */
export function reschedulableReason(b: B, now = new Date()): string | null {
  if (b.rescheduledTo) return 'Este agendamento já foi reagendado.';
  if (b.status === 'SCHEDULED' || b.status === 'CONFIRMED') {
    if (hoursUntil(b.session.startsAt, now) < MIN_RESCHEDULE_HOURS) {
      return `Reagendamentos exigem ${MIN_RESCHEDULE_HOURS}h de antecedência.`;
    }
    return null;
  }
  if (b.status === 'CANCELLED' && b.makeupAvailable) {
    const since = b.cancelledAt ?? b.updatedAt;
    if (now.getTime() - since.getTime() > MAKEUP_VALID_DAYS * 864e5) return 'Crédito de reposição expirado.';
    return null;
  }
  return 'Este agendamento não pode ser reagendado.';
}

export function assertReschedulable(b: B) {
  const reason = reschedulableReason(b);
  if (reason) throw new HttpError(409, reason);
}

export function makeupExpiresAt(b: Pick<Booking, 'cancelledAt' | 'updatedAt'>): Date {
  return new Date((b.cancelledAt ?? b.updatedAt).getTime() + MAKEUP_VALID_DAYS * 864e5);
}
