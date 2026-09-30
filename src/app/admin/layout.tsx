import { AppShell, type NavItem } from '@/components/AppShell';
import { requirePageRole } from '@/lib/session';

const nav: NavItem[] = [
  { href: '/admin', label: 'Início', icon: 'home' },
  { href: '/admin/agenda', label: 'Agenda', icon: 'calendar' },
  { href: '/admin/presenca', label: 'Presença', icon: 'check' },
  { href: '/admin/turmas', label: 'Turmas', icon: 'repeat' },
  { href: '/admin/pacientes', label: 'Pacientes', icon: 'users' },
  { href: '/admin/financeiro', label: 'Financeiro', icon: 'wallet' },
  { href: '/admin/conta', label: 'Minha conta', icon: 'key' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole('ADMIN');
  return (
    <AppShell nav={nav} userName={user.name} roleLabel="Fisioterapeuta · Administrador">
      {children}
    </AppShell>
  );
}
