import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from './prisma';
import { verifySession } from './auth';
import { SESSION_COOKIE, type Role } from './constants';
import { HttpError } from './errors';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  patientId: string | null;
}

/**
 * Lê o JWT do cookie HTTP-only e confirma no banco que o usuário ainda existe,
 * está ativo e mantém o mesmo perfil (revogação imediata ao desativar um usuário).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, name: true, email: true, role: true, active: true, patient: { select: { id: true, active: true } } },
  });
  if (!user || !user.active || user.role !== session.role) return null;
  if (user.role === 'PATIENT' && (!user.patient || !user.patient.active)) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role as Role, patientId: user.patient?.id ?? null };
});

export function homeFor(role: Role) {
  return role === 'ADMIN' ? '/admin' : '/paciente';
}

/** Proteção de páginas (Server Components). */
export async function requirePageRole(role: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== role) redirect(homeFor(user.role));
  return user;
}

/** Proteção de rotas de API. */
export async function requireApiRole(role: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, 'Sessão expirada. Faça login novamente.');
  if (user.role !== role) throw new HttpError(403, 'Acesso não autorizado.');
  return user;
}

export async function requirePatient(): Promise<CurrentUser & { patientId: string }> {
  const user = await requireApiRole('PATIENT');
  if (!user.patientId) throw new HttpError(403, 'Paciente não vinculado.');
  return user as CurrentUser & { patientId: string };
}
