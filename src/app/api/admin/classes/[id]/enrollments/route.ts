import { handler, ok, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireApiRole } from '@/lib/session';
import { patientRefSchema } from '@/lib/validation';
import { enrollPatient, unenrollPatient } from '@/lib/scheduling';
import { HttpError } from '@/lib/errors';

export const POST = handler<{ id: string }>(async (req, { params }) => {
  await requireApiRole('ADMIN');
  const { id } = await params;
  const { patientId } = await parseBody(req, patientRefSchema);
  const result = await prisma.$transaction(async (tx) => {
    const group = await tx.classGroup.findUnique({ where: { id }, include: { _count: { select: { enrollments: true } } } });
    if (!group || !group.active) throw new HttpError(404, 'Turma não encontrada.');
    if (group._count.enrollments >= group.capacity) throw new HttpError(409, 'Turma com todas as vagas fixas ocupadas. Aumente o limite de alunos.');
    const patient = await tx.patient.findUnique({ where: { id: patientId } });
    if (!patient?.active) throw new HttpError(404, 'Paciente não encontrado.');
    return enrollPatient(tx, id, patientId);
  }, { timeout: 30_000 });
  const extra = result.full ? ` ${result.full} aula(s) sem vaga foram ignoradas.` : '';
  return ok({ message: `Paciente matriculado e agendado em ${result.booked} aula(s).${extra}` }, 201);
});

export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  await requireApiRole('ADMIN');
  const { id } = await params;
  const { patientId } = await parseBody(req, patientRefSchema);
  const cancelled = await prisma.$transaction((tx) => unenrollPatient(tx, id, patientId));
  return ok({ message: `Matrícula removida (${cancelled} agendamento(s) futuro(s) cancelado(s)).` });
});
