import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo size="lg" />
      <h1 className="text-4xl font-semibold">Página não encontrada</h1>
      <p className="text-mist-500">O endereço acessado não existe ou foi removido.</p>
      <Link href="/" className="btn-primary">Voltar ao início</Link>
    </div>
  );
}
