// Regras de agenda: geração de aulas recorrentes, matrículas, vagas e agendamentos.
import type { Prisma } from '@prisma/client';
import { HttpError } from './errors';
import { OCCUPYING_STATUSES } from './constants';
import { addDays, studioDate, toDateStr, todayStr, weekdayOf } from './dates';

type Db = Prisma.TransactionClient;

export function parseWeekdays(v: string): number[] {
  return v.split(',').map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

export async function occupiedCount(db: Db, sessionId: string): Promise<number> {
  return db.booking.count({ where: { sessionId, status: { in: OCCUPYING_STATUSES } } });
}

/**
 * Agenda um paciente em uma aula respeitando o limite de vagas
 * e impedindo agendamento duplicado.
 */
export async function bookPatient(
  db: Db,
  sessionId: string,
  patientId: string,
  opts: { isMakeup?: boolean; rescheduledFromId?: string } = {},
) {
  const session = await db.session.findUnique({ where: { id: sessionId } });
  if (!session || session.status !== 'SCHEDULED') throw new HttpError(404, 'Aula não encontrada ou cancelada.');
  const duplicate = await db.booking.findFirst({
    where: { sessionId, patientId, status: { in: OCCUPYING_STATUSES } },
  });
  if (duplicate) throw new HttpError(409, 'Paciente já está agendado nesta aula.');
  const used = await occupiedCount(db, sessionId);
  if (used >= session.capacity) throw new HttpError(409, 'Aula lotada — não há vagas disponíveis.');
  return db.booking.create({
    data: {
      sessionId,
      patientId,
      isMakeup: opts.isMakeup ?? false,
      rescheduledFromId: opts.rescheduledFromId,
    },
  });
}

/**
 * Cria as aulas de uma turma recorrente a partir de `fromDate` por `weeks` semanas
 * e agenda automaticamente os pacientes matriculados (até o limite de vagas).
 */
export async function generateSessions(db: Db, classGroupId: string, fromDate: string, weeks: number) {
  const group = await db.classGroup.findUnique({
    where: { id: classGroupId },
    include: { enrollments: { where: { patient: { active: true } }, orderBy: { createdAt: 'asc' } } },
  });
  if (!group) throw new HttpError(404, 'Turma não encontrada.');
  const weekdays = parseWeekdays(group.weekdays);
  let created = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const day = addDays(fromDate, i);
    if (!weekdays.includes(weekdayOf(day))) continue;
    const startsAt = studioDate(day, group.startTime);
    const exists = await db.session.findUnique({
      where: { classGroupId_startsAt: { classGroupId, startsAt } },
    });
    if (exists) continue;
    const session = await db.session.create({
      data: {
        classGroupId,
        title: group.name,
        modality: group.modality,
        startsAt,
        endsAt: new Date(startsAt.getTime() + group.durationMin * 60_000),
        capacity: group.capacity,
      },
    });
    const enrolled = group.enrollments.slice(0, group.capacity);
    if (enrolled.length) {
      await db.booking.createMany({
        data: enrolled.map((e) => ({ sessionId: session.id, patientId: e.patientId })),
      });
    }
    created++;
  }
  return created;
}

/** Data a partir da qual novas semanas devem ser geradas (dia seguinte à última aula ou hoje). */
export async function nextGenerationStart(db: Db, classGroupId: string): Promise<string> {
  const last = await db.session.findFirst({ where: { classGroupId }, orderBy: { startsAt: 'desc' } });
  const today = todayStr();
  if (!last) return today;
  const after = addDays(toDateStr(last.startsAt), 1);
  return after > today ? after : today;
}

/** Matricula o paciente na turma e o agenda em todas as aulas futuras com vaga. */
export async function enrollPatient(db: Db, classGroupId: string, patientId: string) {
  await db.enrollment.create({ data: { classGroupId, patientId } });
  const sessions = await db.session.findMany({
    where: { classGroupId, status: 'SCHEDULED', startsAt: { gt: new Date() } },
    orderBy: { startsAt: 'asc' },
  });
  let booked = 0;
  let full = 0;
  for (const s of sessions) {
    const already = await db.booking.findFirst({
      where: { sessionId: s.id, patientId, status: { in: OCCUPYING_STATUSES } },
    });
    if (already) continue;
    if ((await occupiedCount(db, s.id)) >= s.capacity) {
      full++;
      continue;
    }
    await db.booking.create({ data: { sessionId: s.id, patientId } });
    booked++;
  }
  return { booked, full };
}

/** Remove a matrícula e cancela os agendamentos futuros daquela turma. */
export async function unenrollPatient(db: Db, classGroupId: string, patientId: string) {
  await db.enrollment.deleteMany({ where: { classGroupId, patientId } });
  const res = await db.booking.updateMany({
    where: {
      patientId,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      session: { classGroupId, startsAt: { gt: new Date() } },
    },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });
  return res.count;
}
