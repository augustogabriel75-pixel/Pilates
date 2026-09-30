import { handler, ok, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireApiRole } from '@/lib/session';
import { createPatientSchema } from '@/lib/validation';
import { hashPassword } from '@/lib/password';
import { studioDate } from '@/lib/dates';
import { HttpError } from '@/lib/errors';

export const GET = handler(async (req) => {
  await requireApiRole('ADMIN');
  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 80);
  const patients = await prisma.patient.findMany({
    where: { active: true, ...(q ? { fullName: { contains: q } } : {}) },
    select: { id: true, fullName: true, phone: true, plan: true },
    orderBy: { fullName: 'asc' },
    take: 100,
  });
  return ok({ patients });
});

export const POST = handler(async (req) => {
  await requireApiRole('ADMIN');
  const { access, birthDate, ...data } = await parseBody(req, createPatientSchema);

  if (access && (await prisma.user.findUnique({ where: { email: access.email } }))) {
    throw new HttpError(409, 'Já existe um usuário com este e-mail de acesso.');
  }

  const patient = await prisma.$transaction(async (tx) => {
    const user = access
      ? await tx.user.create({
          data: { name: data.fullName, email: access.email, passwordHash: await hashPassword(access.password), role: 'PATIENT' },
        })
      : null;
    return tx.patient.create({
      data: {
        ...data,
        email: data.email ?? access?.email ?? null,
        birthDate: birthDate ? studioDate(birthDate, '12:00') : null,
        userId: user?.id,
      },
    });
  });
  return ok({ id: patient.id, message: 'Paciente cadastrado.' }, 201);
});
