// Utilitários de data no fuso horário do estúdio (America/Sao_Paulo, UTC-3, sem horário de verão).
// Datas "de calendário" trafegam como strings YYYY-MM-DD; instantes são Date (UTC no banco).

export const TIMEZONE = 'America/Sao_Paulo';
export const TZ_OFFSET = '-03:00';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateStr(v: unknown): v is string {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Converte um instante para YYYY-MM-DD no fuso do estúdio. */
export function toDateStr(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

export function todayStr(): string {
  return toDateStr(new Date());
}

/** Instante correspondente a uma data/hora local do estúdio. */
export function studioDate(dateStr: string, time = '00:00'): Date {
  return new Date(`${dateStr}T${time}:00${TZ_OFFSET}`);
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo ... 6 = sábado */
export function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

/** Segunda-feira da semana da data. */
export function startOfWeek(dateStr: string): string {
  const wd = weekdayOf(dateStr);
  return addDays(dateStr, wd === 0 ? -6 : 1 - wd);
}

export function startOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

export function addMonths(dateStr: string, n: number): string {
  const [y, m] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1, 12));
  return d.toISOString().slice(0, 10);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function dayRange(dateStr: string) {
  return { start: studioDate(dateStr), end: studioDate(addDays(dateStr, 1)) };
}

export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: TIMEZONE, ...opts });

export function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? studioDate(d, '12:00') : d;
  return fmt({ day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function fmtDateLong(d: Date | string): string {
  const date = typeof d === 'string' ? studioDate(d, '12:00') : d;
  return capFirst(fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(date));
}

export function fmtDayShort(d: Date | string): string {
  const date = typeof d === 'string' ? studioDate(d, '12:00') : d;
  return capFirst(fmt({ weekday: 'short', day: '2-digit', month: '2-digit' }).format(date));
}

export function fmtTime(d: Date): string {
  return fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

export function fmtDateTime(d: Date): string {
  return `${fmtDate(d)} às ${fmtTime(d)}`;
}

export function hoursUntil(d: Date, now = new Date()): number {
  return (d.getTime() - now.getTime()) / 36e5;
}

export function ageFrom(birth: Date | null | undefined): number | null {
  if (!birth) return null;
  const b = toDateStr(birth);
  const t = todayStr();
  let age = Number(t.slice(0, 4)) - Number(b.slice(0, 4));
  if (t.slice(5) < b.slice(5)) age--;
  return age;
}
