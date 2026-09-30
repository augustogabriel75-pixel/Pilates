'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { api } from '@/lib/client-api';

/** Executa uma chamada de API e atualiza os Server Components da página ao concluir. */
export function useApiAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run<T = Record<string, unknown>>(
    url: string,
    opts: { method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown } = {},
    after?: (data: T) => void,
  ): Promise<T | null> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await api<T>(url, opts);
      const msg = (data as { message?: string })?.message;
      if (msg) setMessage(msg);
      after?.(data);
      startTransition(() => router.refresh());
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { run, pending: busy || refreshing, error, message, setError };
}
