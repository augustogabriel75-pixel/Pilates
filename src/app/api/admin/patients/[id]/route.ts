import { handler, ok, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireApiRole } from '@/lib/session';
import { updatePatientSchema } from '@/lib/validation';
import { hashPassword } from '@/lib/password';
import { studioDate } from '@/lib/dates';
import { HttpError } from '@/lib/errors';

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  await requireApiRole('ADMIN');
  const { id } = await params;
  const { access, accessActive, birthDate, ...data } = await parseBody(req, updatePatientSchema);
  const patient = await prisma.patient.findUnique({ where: { id }, include: { user: true } });
  if (!patient) throw new HttpError(404, 'Paciente não encontrado.');

  await prisma.$transaction(async (tx) => {
    await tx.patient.update({
      where: { id },
      data: {
        ...data,
        ...(birthDate !== undefined ? { birthDate: birthDate ? studioDate(birthDate, '12:00') : null } : {}),
      },
    });

    if (access) {
      const other = await tx.user.findUnique({ where: { email: access.email } });
      if (other && other.id !== patient.userId) throw new HttpError(409, 'Já existe um usuário com este e-mail.');
      const passwordHash = await hashPassword(access.password);
      if (patient.user) {
        await tx.user.update({ where: { id: patient.user.id }, data: { email: access.email, passwordHash, active: true } });
      } else {
        const user = await tx.user.create({
          data: { name: data.fullName ?? patient.fullName, email: access.email, passwordHash, role: 'PATIENT' },
        });
        await tx.patient.update({ where: { id }, data: { userId: user.id } });
      }
    }
    if (accessActive !== undefined && patient.user) {
      await tx.user.update({ where: { id: patient.user.id }, data: { active: accessActive } });
    }
    if (data.fullName && patient.user) {
      await tx.user.update({ where: { id: patient.user.id }, data: { name: data.fullName } });
    }
    // Paciente inativado: cancela agendamentos futuros.
    if (data.active === false) {
      await tx.booking.updateMany({
        where: { patientId: id, status: { in: ['SCHEDULED', 'CONFIRMED'] }, session: { startsAt: { gt: new Date() } } },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      await tx.enrollment.deleteMany({ where: { patientId: id } });
    }
  });
  return ok({ message: 'Cadastro atualizado.' });
});
