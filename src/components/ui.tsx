import clsx from 'clsx';
import { BOOKING_STATUS, PAYMENT_STATUS, type BookingStatus, type PaymentStatus } from '@/lib/constants';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-mist-500 dark:text-mist-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = 'default' }: { label: string; value: React.ReactNode; hint?: string; tone?: 'default' | 'good' | 'warn' | 'bad' }) {
  const tones = {
    default: 'text-mist-900 dark:text-sand-50',
    good: 'text-emerald-700 dark:text-emerald-400',
    warn: 'text-sand-700 dark:text-sand-300',
    bad: 'text-red-700 dark:text-red-400',
  };
  return (
    <div className="card card-pad">
      <p className="label">{label}</p>
      <p className={clsx('font-serif text-3xl font-semibold', tones[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-mist-500">{hint}</p>}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-sand-300 p-8 text-center text-sm text-mist-500 dark:border-mist-700 dark:text-mist-400">
      {children}
    </div>
  );
}

const bookingTone: Record<BookingStatus, string> = {
  SCHEDULED: 'bg-sand-100 text-sand-800 dark:bg-sand-900/40 dark:text-sand-200',
  CONFIRMED: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  CHECKED_IN: 'bg-copper-100 text-copper-800 dark:bg-copper-900/50 dark:text-copper-200',
  ATTENDED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  ABSENT: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  CANCELLED: 'bg-mist-100 text-mist-600 dark:bg-mist-800 dark:text-mist-300',
  RESCHEDULED: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
};

export function BookingBadge({ status }: { status: string }) {
  const s = (status in BOOKING_STATUS ? status : 'SCHEDULED') as BookingStatus;
  return <span className={clsx('badge', bookingTone[s])}>{BOOKING_STATUS[s]}</span>;
}

const paymentTone: Record<PaymentStatus, string> = {
  PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  PENDING: 'bg-sand-100 text-sand-800 dark:bg-sand-900/40 dark:text-sand-200',
  LATE: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <span className={clsx('badge', paymentTone[status])}>{PAYMENT_STATUS[status]}</span>;
}

export function Avatar({ name }: { name: string }) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sand-200 text-xs font-semibold text-copper-700 dark:bg-mist-800 dark:text-sand-300">
      {letters}
    </span>
  );
}

export function FormMessage({ error, message }: { error?: string | null; message?: string | null }) {
  if (error) return <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</p>;
  if (message) return <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">{message}</p>;
  return null;
}
