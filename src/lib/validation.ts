// Esquemas de validação (zod). Toda entrada da API passa por aqui:
// tipos, tamanhos e formatos são verificados e textos livres são sanitizados.
import { z } from 'zod';
import { sanitizeText } from './sanitize';
import { isDateStr } from './dates';
import { APPARATUS, MODALITIES, PAYMENT_STATUS } from './constants';

const keys = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

export const reqText = (label: string, max = 200) =>
  z
    .string({ required_error: `${label} é obrigatório`, invalid_type_error: `${label} inválido` })
    .max(max, `${label}: máximo de ${max} caracteres`)
    .transform(sanitizeText)
    .refine((v) => v.length > 0, `${label} é obrigatório`);

export const optText = (max = 500) =>
  z
    .string()
    .max(max, `Máximo de ${max} caracteres`)
    .nullish()
    .transform((v) => {
      if (v == null) return null;
      const s = sanitizeText(v);
      return s === '' ? null : s;
    });

export const idSchema = z.string({ required_error: 'Identificador obrigatório' }).min(1, 'Identificador obrigatório').max(40, 'Identificador inválido').regex(/^[a-z0-9]+$/i, 'Identificador inválido');
export const dateStr = z.string().refine(isDateStr, 'Data inválida');
export const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido');
const optDateStr = z.union([dateStr, z.literal(''), z.null()]).optional().transform((v) => (v ? v : null));

export const emailSchema = z.string().trim().toLowerCase().max(120).email('E-mail inválido');
const optEmail = z
  .union([emailSchema, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .max(128, 'Senha muito longa')
  .regex(/[A-Za-z]/, 'A senha deve conter letras')
  .regex(/\d/, 'A senha deve conter números');

// ---------- Autenticação ----------
export const loginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1, 'Informe usuário ou e-mail').max(120),
  password: z.string().min(1, 'Informe a senha').max(128),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual').max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: 'As senhas não conferem', path: ['confirmPassword'] });

// ---------- Pacientes ----------
export const patientSchema = z.object({
  fullName: reqText('Nome', 120),
  email: optEmail,
  phone: optText(30),
  cpf: z
    .union([z.string().max(20), z.null()])
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, '') : ''))
    .refine((v) => v === '' || v.length === 11, 'CPF deve ter 11 dígitos')
    .transform((v) => (v === '' ? null : v)),
  birthDate: optDateStr,
  address: optText(250),
  emergencyContact: optText(150),
  profession: optText(100),
  medicalHistory: optText(4000),
  medications: optText(1000),
  goals: optText(1000),
  plan: optText(100),
  monthlyFee: z.coerce.number().min(0, 'Valor inválido').max(100000),
  dueDay: z.coerce.number().int().min(1).max(28, 'Use um dia entre 1 e 28'),
  notes: optText(2000),
  active: z.boolean().optional(),
});

export const patientAccessSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const createPatientSchema = patientSchema.extend({
  access: patientAccessSchema.nullish(),
});

export const updatePatientSchema = patientSchema.partial().extend({
  access: patientAccessSchema.nullish(),
  accessActive: z.boolean().optional(),
});

// ---------- Prontuário ----------
export const evolutionSchema = z.object({
  date: dateStr,
  evolutionNotes: reqText('Notas de evolução', 5000),
  painLevel: z.union([z.coerce.number().int().min(0).max(10), z.null()]).optional().transform((v) => v ?? null),
  painLocation: optText(200),
  posturalAssessment: optText(3000),
  observations: optText(3000),
  patientGuidance: optText(2000),
});

export const prescriptionItemSchema = z.object({
  apparatus: z.enum(keys(APPARATUS)),
  exerciseName: reqText('Exercício', 120),
  sets: z.union([z.coerce.number().int().min(1).max(20), z.null()]).optional().transform((v) => v ?? null),
  reps: optText(40),
  load: optText(60),
  notes: optText(300),
});

export const prescriptionSchema = z.object({
  title: reqText('Título', 120),
  frequency: optText(100),
  homeGuidance: optText(3000),
  items: z.array(prescriptionItemSchema).min(1, 'Adicione ao menos um exercício').max(60),
});

export const prescriptionUpdateSchema = z.object({ active: z.boolean() });

// ---------- Agenda ----------
export const modalitySchema = z.enum(keys(MODALITIES));
const capacity = z.coerce.number().int().min(1, 'Mínimo de 1 aluno').max(50);
const duration = z.coerce.number().int().min(15).max(240);

export const classGroupSchema = z.object({
  name: reqText('Nome da turma', 80),
  modality: modalitySchema,
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, 'Escolha ao menos um dia da semana').max(7),
  startTime: timeStr,
  durationMin: duration,
  capacity,
  instructor: optText(80),
  startDate: dateStr,
  weeks: z.coerce.number().int().min(1).max(26),
  patientIds: z.array(idSchema).max(50).default([]),
});

export const classGroupUpdateSchema = z.object({
  name: reqText('Nome da turma', 80).optional(),
  instructor: optText(80),
  capacity: capacity.optional(),
  generateWeeks: z.coerce.number().int().min(1).max(26).optional(),
});

export const patientRefSchema = z.object({ patientId: idSchema });

export const sessionCreateSchema = z.object({
  title: reqText('Título', 80),
  modality: modalitySchema,
  date: dateStr,
  startTime: timeStr,
  durationMin: duration,
  capacity,
  patientIds: z.array(idSchema).max(50).default([]),
});

export const sessionUpdateSchema = z.object({
  capacity: capacity.optional(),
  status: z.enum(['SCHEDULED', 'CANCELLED']).optional(),
  notes: optText(1000),
  markAll: z.enum(['ATTENDED']).optional(),
});

export const adminBookingStatusSchema = z.object({
  status: z.enum(['SCHEDULED', 'ATTENDED', 'ABSENT', 'CANCELLED']),
});

export const patientBookingActionSchema = z.object({
  action: z.enum(['checkin', 'confirm', 'cancel']),
});

export const rescheduleSchema = z.object({
  fromBookingId: idSchema,
  toSessionId: idSchema,
});

// ---------- Financeiro ----------
export const paymentUpsertSchema = z.object({
  patientId: idSchema,
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  status: z.enum(keys(PAYMENT_STATUS)),
  amount: z.coerce.number().min(0).max(100000).optional(),
  method: optText(40),
  notes: optText(300),
});
