import Link from 'next/link';
import { CalendarCheck2, HeartHandshake, NotebookPen, Sparkles } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getCurrentUser, homeFor } from '@/lib/session';

const features = [
  { icon: CalendarCheck2, title: 'Agenda inteligente', text: 'Turmas recorrentes, limite de alunos por horário e reposições organizadas.' },
  { icon: NotebookPen, title: 'Prontuário eletrônico', text: 'Evolução diária, escala de dor, avaliação postural e prescrição por aparelho.' },
  { icon: HeartHandshake, title: 'Portal do paciente', text: 'Check-in, confirmação de aulas, reagendamento e rotinas de exercícios.' },
  { icon: Sparkles, title: 'Gestão simples', text: 'Mensalidades com status de pagamento e presença do dia em poucos toques.' },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-sand-200/60 blur-3xl dark:bg-copper-900/20" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[420px] w-[420px] rounded-full bg-copper-100/70 blur-3xl dark:bg-sand-900/10" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href={user ? homeFor(user.role) : '/login'} className="btn-primary">
            {user ? 'Meu painel' : 'Entrar'}
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-20">
        <section className="max-w-2xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.35em] text-copper-500 dark:text-sand-400">Fisioterapia &amp; Pilates</p>
          <h1 className="text-5xl font-semibold leading-[1.05] sm:text-6xl">
            Movimento com cuidado, <span className="italic text-copper-500 dark:text-sand-400">evolução</span> com propósito.
          </h1>
          <p className="mt-6 text-lg text-mist-600 dark:text-mist-300">
            O Espaço Cativar Pilates acompanha cada paciente de perto — da agenda ao prontuário — em um ambiente acolhedor e seguro.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="btn-primary px-6 py-3 text-base">Acessar o sistema</Link>
          </div>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card card-pad">
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sand-100 text-copper-600 dark:bg-mist-800 dark:text-sand-300">
                <Icon size={22} />
              </span>
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-mist-600 dark:text-mist-400">{text}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="relative border-t border-sand-200 py-6 text-center text-xs text-mist-500 dark:border-mist-800">
        © {new Date().getFullYear()} Espaço Cativar Pilates
      </footer>
    </div>
  );
}
