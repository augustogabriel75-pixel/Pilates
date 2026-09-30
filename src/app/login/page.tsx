import type { Metadata } from 'next';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Entrar' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Aceita apenas caminhos internos para evitar "open redirect".
  const safeNext = typeof next === 'string' && /^\/(?!\/)[\w\-/?=&.%]*$/.test(next) ? next : undefined;
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo size="lg" /></div>
        <div className="card card-pad">
          <h1 className="mb-1 text-2xl font-semibold">Bem-vindo(a)</h1>
          <p className="mb-6 text-sm text-mist-500">Entre com seu usuário ou e-mail.</p>
          <LoginForm next={safeNext} />
        </div>
      </div>
    </div>
  );
}
