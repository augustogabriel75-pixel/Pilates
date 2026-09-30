import Link from 'next/link';
import clsx from 'clsx';

export function Logo({ href = '/', size = 'md', className }: { href?: string; size?: 'md' | 'lg'; className?: string }) {
  const img = size === 'lg' ? 'h-16 w-16' : 'h-10 w-10';
  return (
    <Link href={href} className={clsx('flex items-center gap-3', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="" className={img} />
      <span className="leading-tight">
        <span className={clsx('block font-serif font-semibold text-mist-900 dark:text-sand-50', size === 'lg' ? 'text-3xl' : 'text-lg')}>
          Espaço Cativar
        </span>
        <span className={clsx('block uppercase tracking-[0.3em] text-copper-500 dark:text-sand-400', size === 'lg' ? 'text-sm' : 'text-[10px]')}>
          Pilates
        </span>
      </span>
    </Link>
  );
}
