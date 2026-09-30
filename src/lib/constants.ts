// Constantes compartilhadas entre servidor e cliente (sem dependências de Node).

export const SESSION_COOKIE = 'cativar_session';
export const CSRF_COOKIE = 'cativar_csrf';
export const CSRF_HEADER = 'x-csrf-token';
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 horas

export type Role = 'ADMIN' | 'PATIENT';

/** Antecedência mínima (horas) para cancelar/reagendar com direito a reposição. */
export const MIN_RESCHEDULE_HOURS = 12;
/** Validade (dias) de um crédito de reposição. */
export const MAKEUP_VALID_DAYS = 30;
/** O check-in do aluno é liberado a partir de X horas antes do início da aula (no mesmo dia). */
export const CHECKIN_OPENS_HOURS_BEFORE = 2;
/** Janela (dias) de horários exibidos para reagendamento. */
export const RESCHEDULE_WINDOW_DAYS = 21;

export const MODALITIES = {
  PILATES_APARELHO: 'Pilates Aparelho',
  PILATES_SOLO: 'Pilates Solo',
  FISIOTERAPIA: 'Fisioterapia',
  AVALIACAO: 'Avaliação',
} as const;
export type Modality = keyof typeof MODALITIES;

export const APPARATUS = {
  REFORMER: 'Reformer',
  CADILLAC: 'Cadillac',
  CHAIR: 'Chair',
  BARREL: 'Ladder Barrel',
  MAT: 'Solo (Mat)',
  BALL: 'Bola',
  ACCESSORIES: 'Acessórios',
  PHYSIO: 'Cinesioterapia',
} as const;
export type Apparatus = keyof typeof APPARATUS;

export const BOOKING_STATUS = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  CHECKED_IN: 'Check-in feito',
  ATTENDED: 'Presente',
  ABSENT: 'Falta',
  CANCELLED: 'Cancelado',
  RESCHEDULED: 'Reagendado',
} as const;
export type BookingStatus = keyof typeof BOOKING_STATUS;

/** Status que ocupam vaga na aula. */
export const OCCUPYING_STATUSES: BookingStatus[] = ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'ATTENDED', 'ABSENT'];

export const PAYMENT_STATUS = {
  PAID: 'Pago',
  PENDING: 'Pendente',
  LATE: 'Atrasado',
} as const;
export type PaymentStatus = keyof typeof PAYMENT_STATUS;

export const PAYMENT_METHODS = ['PIX', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Transferência', 'Boleto'] as const;

export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAYS_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
