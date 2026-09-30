'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import clsx from 'clsx';
import {
  CalendarDays, ClipboardCheck, Dumbbell, HeartPulse, Home, KeyRound, LogOut, Menu, Users, Wallet, X, Repeat, LineChart,
} from 'lucide-react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { api } from '@/lib/client-api';

const ICONS = {
  home: Home, calendar: CalendarDays, check: ClipboardCheck, users: Users, wallet: Wallet,
  key: KeyRound, dumbbell: Dumbbell, heart: HeartPulse, repeat: Repeat, chart: LineChart,
};
export type IconName = keyof typeof ICONS;
export interface NavItem { href: string; label: string; icon: IconName }

export function AppShell({ nav, userName, roleLabel, children }: { nav: NavItem[]; userName: string; roleLabel: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const home = nav[0]!.href;

  async function logout() {
    try {
      await api('/api/auth/logout');
    } finally {
      window.location.href = '/login';
    }
  }

  const isActive = (href: string) => (href === home ? pathname === href : pathname === href || pathname.startsWith(href + '/'));

  const links = (
    <nav className="flex flex-col gap-1">
      {nav.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={clsx(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              active
                ? 'bg-copper-500 text-white shadow-soft'
                : 'text-mist-600 hover:bg-sand-100 dark:text-mist-300 dark:hover:bg-mist-800',
            )}
          >
            <Icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="mt-auto border-t border-sand-200 pt-4 dark:border-mist-800">
      <p className="truncate text-sm font-semibold text-mist-800 dark:text-sand-100">{userName}</p>
      <p className="text-xs text-mist-500">{roleLabel}</p>
      <div className="mt-3 flex items-center gap-2">
        <ThemeToggle className="btn-secondary btn-sm" />
        <button onClick={logout} className="btn-secondary btn-sm flex-1">
          <LogOut size={16} /> Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-8 border-r border-sand-200 bg-white/70 p-5 backdrop-blur dark:border-mist-800 dark:bg-mist-900/70 lg:flex">
        <Logo href={home} />
        {links}
        {footer}
      </aside>

      {/* Mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sand-200 bg-sand-50/90 px-4 py-3 backdrop-blur dark:border-mist-800 dark:bg-mist-950/90 lg:hidden">
        <Logo href={home} />
        <button className="btn-ghost" aria-label="Abrir menu" onClick={() => setOpen(true)}>
          <Menu size={22} />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-mist-950/40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-72 flex-col gap-6 bg-sand-50 p-5 shadow-xl dark:bg-mist-900">
            <button className="btn-ghost self-end" aria-label="Fechar menu" onClick={() => setOpen(false)}>
              <X size={22} />
            </button>
            {links}
            {footer}
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
