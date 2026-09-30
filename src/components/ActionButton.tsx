'use client';
import clsx from 'clsx';
import { useApiAction } from './useApiAction';

export function ActionButton({
  url,
  method = 'POST',
  body,
  children,
  className = 'btn-secondary btn-sm',
  confirm,
  title,
}: {
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  title?: string;
}) {
  const { run, pending, error, message } = useApiAction();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        title={title}
        disabled={pending}
        className={clsx(className, pending && 'opacity-60')}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          void run(url, { method, body });
        }}
      >
        {children}
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      {message && <span className="text-xs text-emerald-700 dark:text-emerald-400">{message}</span>}
    </span>
  );
}
