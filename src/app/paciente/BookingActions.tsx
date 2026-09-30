'use client';
import Link from 'next/link';
import { CalendarClock, CheckCircle2, MapPinCheck, XCircle } from 'lucide-react';
import { useApiAction } from '@/components/useApiAction';

export function BookingActions({ bookingId, canCheckin, canConfirm, canCancel, canReschedule, cancelWarning }: {
  bookingId: string; canCheckin?: boolean; canConfirm?: boolean; canCancel?: boolean; canReschedule?: boolean; cancelWarning?: string;
}) {
  const { run, pending, error, message } = useApiAction();
  const act = (action: 'checkin' | 'confirm' | 'cancel') => run(`/api/patient/bookings/${bookingId}`, { body: { action } });

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        {canCheckin && (
          <button className="btn-primary" disabled={pending} onClick={() => act('checkin')}>
            <MapPinCheck size={16} /> Estou aqui — fazer check-in
          </button>
        )}
        {canConfirm && (
          <button className="btn-secondary btn-sm" disabled={pending} onClick={() => act('confirm')}>
            <CheckCircle2 size={14} /> Confirmar presença
          </button>
        )}
        {canReschedule && (
          <Link href={`/paciente/reagendar?from=${bookingId}`} className="btn-secondary btn-sm">
            <CalendarClock size={14} /> Reagendar
          </Link>
        )}
        {canCancel && (
          <button
            className="btn-ghost btn-sm text-red-600"
            disabled={pending}
            onClick={() => window.confirm(cancelWarning ?? 'Cancelar esta aula?') && act('cancel')}
          >
            <XCircle size={14} /> Cancelar
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {message && <p className="text-xs text-emerald-700 dark:text-emerald-400">{message}</p>}
    </div>
  );
}
