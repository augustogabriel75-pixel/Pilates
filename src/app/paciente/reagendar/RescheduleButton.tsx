'use client';
import { useRouter } from 'next/navigation';
import { useApiAction } from '@/components/useApiAction';

export function RescheduleButton({ fromBookingId, toSessionId, label }: { fromBookingId: string; toSessionId: string; label: string }) {
  const router = useRouter();
  const { run, pending, error } = useApiAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="btn-primary btn-sm"
        disabled={pending}
        onClick={async () => {
          if (!window.confirm(`Confirmar reagendamento para ${label}?`)) return;
          if (await run('/api/patient/reschedule', { body: { fromBookingId, toSessionId } })) router.push('/paciente/agenda');
        }}
      >
        Escolher
      </button>
      {error && <p className="max-w-[12rem] text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
