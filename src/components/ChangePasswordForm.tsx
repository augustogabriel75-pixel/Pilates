'use client';
import { useState } from 'react';
import { useApiAction } from './useApiAction';
import { FormMessage } from './ui';

export function ChangePasswordForm() {
  const { run, pending, error, message } = useApiAction();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <form
      className="card card-pad max-w-md space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run('/api/auth/change-password', { body: form });
        if (ok) setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }}
    >
      <div>
        <label className="label" htmlFor="cp">Senha atual</label>
        <input id="cp" type="password" className="input" autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} required />
      </div>
      <div>
        <label className="label" htmlFor="np">Nova senha</label>
        <input id="np" type="password" className="input" autoComplete="new-password" minLength={8} value={form.newPassword} onChange={set('newPassword')} required />
        <p className="mt-1 text-xs text-mist-500">Mínimo de 8 caracteres, com letras e números.</p>
      </div>
      <div>
        <label className="label" htmlFor="cf">Confirmar nova senha</label>
        <input id="cf" type="password" className="input" autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} required />
      </div>
      <FormMessage error={error} message={message} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? 'Salvando…' : 'Alterar senha'}</button>
    </form>
  );
}
