import Link from 'next/link';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requirePageRole } from '@/lib/session';
import {
  addDays, addMonths, fmtDateLong, fmtTime, isDateStr, startOfMonth, startOfWeek, studioDate, toDateStr, todayStr, weekdayOf,
} from '@/lib/dates';
import { MODALITIES, MONTHS, OCCUPYING_STATUSES, WEEKDAYS_SHORT, type Modality } from '@/lib/constants';
import { BookingBadge, EmptyState, PageHeader } from '@/components/ui';
import { NewSessionForm } from './NewSessionForm';

export const metadata = { title: 'Agenda' };

type View = 'day' | 'week' | 'month';

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  await requirePageRole('ADMIN');
  const sp = await searchParams;
  const view: View = sp.view === 'day' || sp.view === 'month' ? sp.view : 'week';
  const date = isDateStr(sp.date) ? sp.date : todayStr();
  const today = todayStr();

  let from: string, to: string, prev: string, next: string, label: string;
  if (view === 'day') {
    from = date; to = addDays(date, 1); prev = addDays(date, -1); next = addDays(date, 1);
    label = fmtDateLong(date);
  } else if (view === 'week') {
    from = startOfWeek(date); to = addDays(from, 7); prev = addDays(from, -7); next = addDays(from, 7);
    label = `${fmtDateLong(from)} — ${fmtDateLong(addDays(from, 6))}`;
  } else {
    const first = startOfMonth(date);
    from = startOfWeek(first);
    const last = addDays(addMonths(first, 1), -1);
    to = addDays(startOfWeek(last), 7);
    prev = addMonths(first, -1); next = addMonths(first, 1);
    label = `${MONTHS[Number(first.slice(5, 7)) - 1]} de ${first.slice(0, 4)}`;
  }

  const [sessions, patients] = await Promise.all([
    prisma.session.findMany({
      where: { startsAt: { gte: studioDate(from), lt: studioDate(to) } },
      orderBy: { startsAt: 'asc' },
      include: {
        bookings: {
          where: { status: { in: OCCUPYING_STATUSES } },
          include: { patient: { select: { fullName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    prisma.patient.findMany({ where: { active: true }, select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } }),
  ]);

  const byDay = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const k = toDateStr(s.startsAt);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  const href = (v: View, d: string) => `/admin/agenda?view=${v}&date=${d}`;

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Aulas do estúdio por dia, semana ou mês."
        actions={<Link href="/admin/turmas" className="btn-secondary">Turmas recorrentes</Link>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl bg-white/70 p-1 dark:bg-mist-900">
          {(['day', 'week', 'month'] as View[]).map((v) => (
            <Link key={v} href={href(v, date)} className={clsx('tab', view === v && 'tab-active')}>
              {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Mês'}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href={href(view, prev)} className="btn-secondary btn-sm" aria-label="Anterior"><ChevronLeft size={16} /></Link>
          <Link href={href(view, today)} className="btn-secondary btn-sm">Hoje</Link>
          <Link href={href(view, next)} className="btn-secondary btn-sm" aria-label="Próximo"><ChevronRight size={16} /></Link>
          <span className="ml-2 text-sm font-medium">{label}</span>
        </div>
      </div>

      <NewSessionForm patients={patients} defaultDate={view === 'day' ? date : today} />

      {view === 'day' && (
        <div className="mt-4 space-y-3">
          {sessions.length === 0 && <EmptyState>Nenhuma aula neste dia.</EmptyState>}
          {sessions.map((s) => (
            <Link key={s.id} href={`/admin/agenda/sessao/${s.id}`} className={clsx('card card-pad flex flex-col gap-3 sm:flex-row sm:items-start', s.status === 'CANCELLED' && 'opacity-60')}>
              <div className="w-24 shrink-0">
                <p className="font-serif text-2xl font-semibold text-copper-600 dark:text-sand-300">{fmtTime(s.startsAt)}</p>
                <p className="text-xs text-mist-500">até {fmtTime(s.endsAt)}</p>
              </div>
              <div className="flex-1">
                <p className="font-semibold">{s.title} {s.status === 'CANCELLED' && <span className="badge ml-1 bg-red-100 text-red-700">Cancelada</span>}</p>
                <p className="text-xs text-mist-500">{MODALITIES[s.modality as Modality] ?? s.modality} · {s.bookings.length}/{s.capacity} alunos</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {s.bookings.map((b) => (
                    <li key={b.id} className="flex items-center gap-1.5 rounded-full bg-sand-50 py-0.5 pl-3 pr-1 text-xs dark:bg-mist-800">
                      {b.patient.fullName} <BookingBadge status={b.status} />
                    </li>
                  ))}
                </ul>
              </div>
            </Link>
          ))}
        </div>
      )}

      {view === 'week' && (
        <div className="mt-4 grid gap-3 md:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => (
            <div key={d} className={clsx('card p-3', d === today && 'ring-2 ring-copper-300')}>
              <Link href={href('day', d)} className="mb-2 block text-xs font-semibold uppercase tracking-wide text-mist-500 hover:text-copper-600">
                {WEEKDAYS_SHORT[weekdayOf(d)]} {d.slice(8, 10)}/{d.slice(5, 7)}
              </Link>
              <div className="space-y-2">
                {(byDay.get(d) ?? []).map((s) => (
                  <SessionChip key={s.id} s={s} />
                ))}
                {!byDay.get(d) && <p className="text-xs text-mist-400">—</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'month' && (
        <div className="card mt-4 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-sand-100 text-center text-xs font-semibold uppercase text-mist-500 dark:border-mist-800">
            {[1, 2, 3, 4, 5, 6, 0].map((w) => <div key={w} className="py-2">{WEEKDAYS_SHORT[w]}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: Math.round((studioDate(to).getTime() - studioDate(from).getTime()) / 864e5) }, (_, i) => addDays(from, i)).map((d) => {
              const list = byDay.get(d) ?? [];
              const active = list.filter((s) => s.status === 'SCHEDULED');
              const booked = active.reduce((n, s) => n + s.bookings.length, 0);
              const cap = active.reduce((n, s) => n + s.capacity, 0);
              const inMonth = d.slice(0, 7) === startOfMonth(date).slice(0, 7);
              return (
                <Link key={d} href={href('day', d)} className={clsx('min-h-[72px] border-b border-r border-sand-100 p-1.5 text-xs hover:bg-sand-50 dark:border-mist-800 dark:hover:bg-mist-800 sm:min-h-[96px] sm:p-2', !inMonth && 'opacity-40')}>
                  <span className={clsx('inline-flex h-6 w-6 items-center justify-center rounded-full', d === today && 'bg-copper-500 text-white')}>{Number(d.slice(8, 10))}</span>
                  {active.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      <p className="font-medium text-copper-700 dark:text-sand-300">{active.length} aula{active.length > 1 ? 's' : ''}</p>
                      <p className="hidden text-mist-500 sm:block">{booked}/{cap} vagas</p>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function SessionChip({ s }: { s: { id: string; title: string; startsAt: Date; capacity: number; status: string; bookings: unknown[] } }) {
  const full = s.bookings.length >= s.capacity;
  return (
    <Link
      href={`/admin/agenda/sessao/${s.id}`}
      className={clsx(
        'block rounded-lg border-l-4 bg-sand-50 px-2 py-1.5 text-xs hover:bg-sand-100 dark:bg-mist-800 dark:hover:bg-mist-700',
        s.status === 'CANCELLED' ? 'border-mist-300 line-through opacity-60' : full ? 'border-copper-500' : 'border-sand-400',
      )}
    >
      <span className="font-semibold">{fmtTime(s.startsAt)}</span> {s.title}
      <span className="block text-mist-500">{s.bookings.length}/{s.capacity} alunos</span>
    </Link>
  );
}
