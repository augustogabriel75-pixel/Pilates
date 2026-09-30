// Middleware de segurança (Edge):
//  1. Proteção CSRF em toda requisição de API que altera dados (Origin + double-submit token).
//  2. Autorização por perfil (RBAC): /admin e /api/admin exigem ADMIN; /paciente e /api/patient exigem PATIENT.
//  3. Emissão do cookie CSRF.
// As rotas de API e páginas repetem a checagem no servidor (defesa em profundidade).
import { NextResponse, type NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth';
import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE } from '@/lib/constants';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function secure() {
  const v = process.env.COOKIE_SECURE;
  return v === 'true' || (v !== 'false' && process.env.NODE_ENV === 'production');
}

function deny(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function withCsrfCookie(req: NextRequest, res: NextResponse) {
  if (!req.cookies.get(CSRF_COOKIE)) {
    res.cookies.set(CSRF_COOKIE, randomToken(), {
      httpOnly: false, // precisa ser lido pelo JS para ser reenviado no header
      sameSite: 'strict',
      secure: secure(),
      path: '/',
    });
  }
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');

  if (isApi && !SAFE_METHODS.has(req.method)) {
    if (!sameOrigin(req)) return deny(403, 'Origem da requisição não permitida.');
    const cookieToken = req.cookies.get(CSRF_COOKIE)?.value;
    const headerToken = req.headers.get(CSRF_HEADER);
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return deny(403, 'Token CSRF inválido. Recarregue a página e tente novamente.');
    }
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  const home = session?.role === 'ADMIN' ? '/admin' : '/paciente';

  const needsAdmin = pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/');
  const needsPatient = pathname === '/paciente' || pathname.startsWith('/paciente/') || pathname.startsWith('/api/patient/');

  if (needsAdmin || needsPatient) {
    if (!session) {
      if (isApi) return deny(401, 'Não autenticado.');
      const url = new URL('/login', req.url);
      url.searchParams.set('next', pathname + search);
      const res = NextResponse.redirect(url);
      if (token) res.cookies.delete(SESSION_COOKIE); // token expirado/inválido
      return withCsrfCookie(req, res);
    }
    const allowed = needsAdmin ? session.role === 'ADMIN' : session.role === 'PATIENT';
    if (!allowed) {
      if (isApi) return deny(403, 'Acesso não autorizado.');
      return withCsrfCookie(req, NextResponse.redirect(new URL(home, req.url)));
    }
  }

  if (pathname === '/login' && session) {
    return withCsrfCookie(req, NextResponse.redirect(new URL(home, req.url)));
  }

  return withCsrfCookie(req, NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt)$).*)'],
};
