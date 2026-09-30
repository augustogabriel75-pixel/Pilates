import { AppShell, type NavItem } from '@/components/AppShell';
import { requirePageRole } from '@/lib/session';

const nav: NavItem[] = [
  { href: '/paciente', label: 'Início', icon: 'home' },
  { href: '/paciente/agenda', label: 'Minha agenda', icon: 'calendar' },
  { href: '/paciente/exercicios', label: 'Meus exercícios', icon: 'dumbbell' },
  { href: '/paciente/evolucao', label: 'Minha evolução', icon: 'chart' },
  { href: '/paciente/conta', label: 'Minha conta', icon: 'key' },
];

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole('PATIENT');
  return <AppShell nav={nav} userName={user.name} roleLabel="Paciente">{children}</AppShell>;
}
