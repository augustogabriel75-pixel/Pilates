// Assinatura/verificação de JWT. Compatível com o Edge runtime (usado pelo middleware).
import { SignJWT, jwtVerify } from 'jose';
import { SESSION_MAX_AGE, type Role } from './constants';

const ISSUER = 'espaco-cativar';
const AUDIENCE = 'espaco-cativar-app';

export interface SessionPayload {
  sub: string;
  role: Role;
  name: string;
  patientId: string | null;
}

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET ausente ou muito curto (mínimo 32 caracteres). Configure o arquivo .env.');
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ role: p.role, name: p.name, patientId: p.patientId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(p.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    const role = payload.role;
    if (typeof payload.sub !== 'string' || (role !== 'ADMIN' && role !== 'PATIENT')) return null;
    return {
      sub: payload.sub,
      role,
      name: typeof payload.name === 'string' ? payload.name : '',
      patientId: typeof payload.patientId === 'string' ? payload.patientId : null,
    };
  } catch {
    return null;
  }
}

export function cookieSecure(): boolean {
  const v = process.env.COOKIE_SECURE;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return process.env.NODE_ENV === 'production';
}
