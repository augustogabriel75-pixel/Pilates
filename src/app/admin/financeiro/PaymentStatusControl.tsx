'use client';
import clsx from 'clsx';
import { useApiAction } from '@/components/useApiAction';
import { PAYMENT_STATUS, type PaymentStatus } from '@/lib/constants';

const tone: Record<PaymentStatus, string> = {
  PAID: 'bg-emerald-600 text-white',
  PENDING: 'bg-sand-400 text-white',
  LATE: 'bg-red-600 text-white',
};

/** Alterna e registra manualmente o status de pagamento. */
export function PaymentStatusControl({ patientId, year, month, status }: { patientId: string; year: number; month: number; status: PaymentStatus }) {
  const { run, pending, error } = useApiAction();
  return (
    <div>
      <div className="inline-flex rounded-lg border border-sand-200 p-0.5 dark:border-mist-700" role="group" aria-label="Status do pagamento">
        {(Object.keys(PAYMENT_STATUS) as PaymentStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            aria-pressed={status === s}
            onClick={() => status !== s && run('/api/admin/payments', { method: 'PUT', body: { patientId, year, month, status: s } })}
            className={clsx('rounded-md px-2.5 py-1 text-xs font-medium transition', status === s ? tone[s] : 'text-mist-500 hover:bg-sand-100 dark:hover:bg-mist-800')}
          >
            {PAYMENT_STATUS[s]}
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
