'use client';
import { useState } from 'react';
import { api } from '@/lib/client-api';
import { FormMessage } from '@/components/ui';

export function LoginForm({ next }: { next?: string }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const data = await api<{ role: 'ADMIN' | 'PATIENT'; redirectTo: string }>('/api/auth/login', { body: { identifier, password } });
      const prefix = data.role === 'ADMIN' ? '/admin' : '/paciente';
      const target = next && next.startsWith(prefix) ? next : data.redirectTo;
      window.location.href = target;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login');
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="identifier" className="label">Usuário ou e-mail</label>
        <input id="identifier" className="input" autoComplete="username" autoCapitalize="none" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required maxLength={120} />
      </div>
      <div>
        <label htmlFor="password" className="label">Senha</label>
        <input id="password" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={128} />
      </div>
      <FormMessage error={error} />
      <button className="btn-primary w-full py-3" disabled={pending}>{pending ? 'Entrando…' : 'Entrar'}</button>
    </form>
  );
}
