import type { Booking, Session } from '@prisma/client';
import { CHECKIN_OPENS_HOURS_BEFORE, MIN_RESCHEDULE_HOURS } from './constants';
import { hoursUntil, toDateStr, todayStr } from './dates';

/** Quais ações o paciente pode executar em um agendamento (espelha as regras da API). */
export function bookingPermissions(b: Booking & { session: Session }, now = new Date()) {
  const open = b.status === 'SCHEDULED' || b.status === 'CONFIRMED';
  const active = b.session.status === 'SCHEDULED';
  const future = b.session.startsAt > now;
  const hours = hoursUntil(b.session.startsAt, now);
  return {
    canCheckin: active && open && toDateStr(b.session.startsAt) === todayStr() && hours <= CHECKIN_OPENS_HOURS_BEFORE,
    canConfirm: active && future && b.status === 'SCHEDULED',
    canCancel: active && future && open,
    canReschedule: active && future && open && hours >= MIN_RESCHEDULE_HOURS,
    cancelWarning:
      hours >= MIN_RESCHEDULE_HOURS
        ? 'Cancelar esta aula? Você receberá um crédito de reposição.'
        : `Faltam menos de ${MIN_RESCHEDULE_HOURS}h para a aula: o cancelamento NÃO gera reposição. Deseja cancelar mesmo assim?`,
  };
}
