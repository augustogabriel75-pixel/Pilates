import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requirePageRole } from '@/lib/session';
import { addDays, dayRange, fmtDateLong, fmtTime, isDateStr, todayStr } from '@/lib/dates';
import { MODALITIES, type Modality } from '@/lib/constants';
import { EmptyState, PageHeader } from '@/components/ui';
import { AttendanceList } from './AttendanceList';

export const metadata = { title: 'Presença' };

export default async function PresencaPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requirePageRole('ADMIN');
  const sp = await searchParams;
  const date = isDateStr(sp.date) ? sp.date : todayStr();
  const { start, end } = dayRange(date);
  const sessions = await prisma.session.findMany({
    where: { startsAt: { gte: start, lt: end }, status: 'SCHEDULED' },
    orderBy: { startsAt: 'asc' },
    include: { bookings: { include: { patient: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'asc' } } },
  });

  return (
    <>
      <PageHeader title="Controle de presença" subtitle="Valide rapidamente a presença dos alunos. O check-in feito pelo aluno aparece aqui." />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link href={`/admin/presenca?date=${addDays(date, -1)}`} className="btn-secondary btn-sm" aria-label="Dia anterior"><ChevronLeft size={16} /></Link>
        <Link href="/admin/presenca" className="btn-secondary btn-sm">Hoje</Link>
        <Link href={`/admin/presenca?date=${addDays(date, 1)}`} className="btn-secondary btn-sm" aria-label="Próximo dia"><ChevronRight size={16} /></Link>
        <form className="flex gap-2" action="/admin/presenca">
          <input type="date" name="date" defaultValue={date} className="input py-1.5" />
          <button className="btn-secondary btn-sm">Ir</button>
        </form>
        <span className="text-sm font-medium">{fmtDateLong(date)}</span>
      </div>
      {sessions.length === 0 ? (
        <EmptyState>Nenhuma aula neste dia.</EmptyState>
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => (
            <AttendanceList
              key={s.id}
              header={
                <Link href={`/admin/agenda/sessao/${s.id}`} className="font-semibold hover:underline">
                  <span className="font-serif text-xl text-copper-600 dark:text-sand-300">{fmtTime(s.startsAt)}</span> · {s.title}
                  <span className="ml-2 text-xs font-normal text-mist-500">{MODALITIES[s.modality as Modality]}</span>
                </Link>
              }
              session={{
                id: s.id, title: s.title, startsAt: s.startsAt.toISOString(), capacity: s.capacity, status: s.status,
                bookings: s.bookings.map((b) => ({
                  id: b.id, status: b.status, isMakeup: b.isMakeup, patientId: b.patient.id, patientName: b.patient.fullName,
                  checkedInAt: b.checkedInAt ? fmtTime(b.checkedInAt) : null,
                })),
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
