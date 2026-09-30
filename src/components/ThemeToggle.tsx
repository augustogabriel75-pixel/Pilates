'use client';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle({ className = 'btn-ghost' }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {}
  }

  return (
    <button type="button" onClick={toggle} className={className} aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
