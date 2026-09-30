'use client';
import clsx from 'clsx';
import { Check, X, Undo2, Ban } from 'lucide-react';
import { useApiAction } from '@/components/useApiAction';
import { BookingBadge, FormMessage } from '@/components/ui';

export interface AttendanceSession {
  id: string;
  title: string;
  startsAt: string;
  capacity: number;
  status: string;
  bookings: { id: string; status: string; isMakeup: boolean; patientId: string; patientName: string; checkedInAt: string | null }[];
}

const OPEN = ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'];
const OCCUPYING = [...OPEN, 'ATTENDED', 'ABSENT'];

export function AttendanceList({ session, showCancelled = false, header }: { session: AttendanceSession; showCancelled?: boolean; header?: React.ReactNode }) {
  const { run, pending, error, message } = useApiAction();
  const list = showCancelled ? session.bookings : session.bookings.filter((b) => OCCUPYING.includes(b.status));
  const occupied = session.bookings.filter((b) => OCCUPYING.includes(b.status)).length;
  const hasOpen = session.bookings.some((b) => OPEN.includes(b.status));
  const setStatus = (id: string, status: string) => run(`/api/admin/bookings/${id}`, { method: 'PATCH', body: { status } });

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-100 p-4 dark:border-mist-800">
        <div>
          {header}
          <p className="text-sm text-mist-500">{occupied}/{session.capacity} alunos</p>
        </div>
        {hasOpen && session.status === 'SCHEDULED' && (
          <button
            className="btn-success btn-sm"
            disabled={pending}
            onClick={() => run(`/api/admin/sessions/${session.id}`, { method: 'PATCH', body: { markAll: 'ATTENDED' } })}
          >
            <Check size={14} /> Todos presentes
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="p-4 text-sm text-mist-500">Nenhum aluno agendado.</p>
      ) : (
        <ul>
          {list.map((b) => (
            <li key={b.id} className={clsx('flex flex-wrap items-center gap-3 border-t border-sand-100 px-4 py-3 first:border-t-0 dark:border-mist-800', !OCCUPYING.includes(b.status) && 'opacity-60')}>
              <div className="min-w-0 flex-1">
                <a href={`/admin/pacientes/${b.patientId}`} className="font-medium hover:underline">{b.patientName}</a>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-mist-500">
                  <BookingBadge status={b.status} />
                  {b.isMakeup && <span className="badge bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">Reposição</span>}
                  {b.checkedInAt && <span>check-in às {b.checkedInAt}</span>}
                </div>
              </div>
              {session.status === 'SCHEDULED' && (
                <div className="flex gap-1.5">
                  {OCCUPYING.includes(b.status) ? (
                    <>
                      <button disabled={pending || b.status === 'ATTENDED'} onClick={() => setStatus(b.id, 'ATTENDED')} className="btn-success btn-sm" title="Presente"><Check size={14} /> Presente</button>
                      <button disabled={pending || b.status === 'ABSENT'} onClick={() => setStatus(b.id, 'ABSENT')} className="btn-danger btn-sm" title="Falta"><X size={14} /> Falta</button>
                      {(b.status === 'ATTENDED' || b.status === 'ABSENT') && (
                        <button disabled={pending} onClick={() => setStatus(b.id, 'SCHEDULED')} className="btn-ghost btn-sm" title="Desfazer"><Undo2 size={14} /></button>
                      )}
                      {OPEN.includes(b.status) && (
                        <button
                          disabled={pending}
                          onClick={() => window.confirm(`Remover ${b.patientName} desta aula?`) && setStatus(b.id, 'CANCELLED')}
                          className="btn-ghost btn-sm" title="Remover da aula"
                        ><Ban size={14} /></button>
                      )}
                    </>
                  ) : b.status === 'CANCELLED' ? (
                    <button disabled={pending} onClick={() => setStatus(b.id, 'SCHEDULED')} className="btn-ghost btn-sm">Reabrir</button>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="px-4 pb-3 empty:hidden"><FormMessage error={error} message={message} /></div>
    </div>
  );
}
