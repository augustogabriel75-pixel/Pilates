import { NextResponse } from 'next/server';
import { handler, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/validation';
import { DUMMY_HASH, verifyPassword } from '@/lib/password';
import { cookieSecure, signSession } from '@/lib/auth';
import { SESSION_COOKIE, SESSION_MAX_AGE, type Role } from '@/lib/constants';
import { loginLimiter } from '@/lib/rate-limit';
import { HttpError } from '@/lib/errors';

export const POST = handler(async (req) => {
  const { identifier, password } = await parseBody(req, loginSchema);
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
  const key = `${ip}|${identifier}`;
  if (loginLimiter.isBlocked(key)) {
    throw new HttpError(429, 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.');
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
    include: { patient: { select: { id: true, active: true } } },
  });
  // Sempre executa o bcrypt (mesmo sem usuário) para não revelar quais contas existem.
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  const patientBlocked = user?.role === 'PATIENT' && (!user.patient || !user.patient.active);
  if (!user || !valid || !user.active || patientBlocked) {
    loginLimiter.hit(key);
    throw new HttpError(401, 'Usuário ou senha inválidos.');
  }
  loginLimiter.reset(key);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const role = user.role as Role;
  const token = await signSession({ sub: user.id, role, name: user.name, patientId: user.patient?.id ?? null });
  const res = NextResponse.json({ role, redirectTo: role === 'ADMIN' ? '/admin' : '/paciente' });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
});
