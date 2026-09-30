// Cliente HTTP do frontend: envia o token CSRF (double-submit cookie) em toda mutação.
import { CSRF_COOKIE, CSRF_HEADER } from './constants';

function csrfToken(): string {
  const entry = document.cookie.split('; ').find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  return entry ? decodeURIComponent(entry.slice(CSRF_COOKIE.length + 1)) : '';
}

export async function api<T = Record<string, unknown>>(
  url: string,
  options: { method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(url, {
    method: options.method ?? 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: csrfToken() },
    body: JSON.stringify(options.body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.startsWith('/api/auth/login')) {
    window.location.href = '/login';
  }
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Não foi possível concluir a operação.');
  return data as T;
}
