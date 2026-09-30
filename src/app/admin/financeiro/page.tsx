import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requirePageRole } from '@/lib/session';
import { fmtDate, todayStr } from '@/lib/dates';
import { MONTHS, PAYMENT_STATUS, type PaymentStatus } from '@/lib/constants';
import { dueDateFor, effectiveStatus } from '@/lib/payments';
import { brl } from '@/lib/format';
import { Avatar, EmptyState, PageHeader, PaymentBadge, StatCard } from '@/components/ui';
import { PaymentStatusControl } from './PaymentStatusControl';

export const metadata = { title: 'Financeiro' };

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string; q?: string; status?: string }> }) {
  await requirePageRole('ADMIN');
  const sp = await searchParams;
  const today = todayStr();
  const month = Math.min(12, Math.max(1, Number(sp.month) || Number(today.slice(5, 7))));
  const year = Math.min(2100, Math.max(2000, Number(sp.year) || Number(today.slice(0, 4))));
  const q = (sp.q ?? '').trim().slice(0, 80);
  const statusFilter = sp.status && sp.status in PAYMENT_STATUS ? (sp.status as PaymentStatus) : null;

  const patients = await prisma.patient.findMany({
    where: { active: true, ...(q ? { fullName: { contains: q } } : {}) },
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, plan: true, monthlyFee: true, dueDay: true, payments: { where: { year, month } } },
  });

  const rows = patients.map((p) => {
    const pay = p.payments[0];
    return {
      ...p,
      amount: pay?.amount ?? p.monthlyFee,
      dueDate: pay?.dueDate ?? dueDateFor(year, month, p.dueDay),
      paidAt: pay?.paidAt ?? null,
      method: pay?.method ?? null,
      status: effectiveStatus(pay, year, month, p.dueDay),
    };
  });
  const totals = { PAID: 0, PENDING: 0, LATE: 0 } as Record<PaymentStatus, number>;
  const counts = { PAID: 0, PENDING: 0, LATE: 0 } as Record<PaymentStatus, number>;
  for (const r of rows) {
    totals[r.status] += r.amount;
    counts[r.status]++;
  }
  const visible = statusFilter ? rows.filter((r) => r.status === statusFilter) : rows;
  const years = Array.from({ length: 5 }, (_, i) => Number(today.slice(0, 4)) - 3 + i);
  const filterHref = (s: PaymentStatus | null) => `/admin/financeiro?month=${month}&year=${year}${q ? `&q=${encodeURIComponent(q)}` : ''}${s ? `&status=${s}` : ''}`;

  return (
    <>
      <PageHeader title="Financeiro" subtitle={`Mensalidades de ${MONTHS[month - 1]} de ${year}`} />

      <form className="card card-pad mb-5 grid gap-2 sm:grid-cols-5" action="/admin/financeiro">
        <select name="month" defaultValue={month} className="input">
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select name="year" defaultValue={year} className="input">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <input name="q" defaultValue={q} placeholder="Buscar paciente…" className="input sm:col-span-2" maxLength={80} />
        {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
        <button className="btn-primary">Filtrar</button>
      </form>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link href={filterHref(statusFilter === 'PAID' ? null : 'PAID')}><StatCard label={`Pagos (${counts.PAID})`} value={brl(totals.PAID)} tone="good" /></Link>
        <Link href={filterHref(statusFilter === 'PENDING' ? null : 'PENDING')}><StatCard label={`Pendentes (${counts.PENDING})`} value={brl(totals.PENDING)} tone="warn" /></Link>
        <Link href={filterHref(statusFilter === 'LATE' ? null : 'LATE')}><StatCard label={`Atrasados (${counts.LATE})`} value={brl(totals.LATE)} tone="bad" /></Link>
      </div>
      {statusFilter && (
        <p className="mb-3 text-sm">Filtrando: <PaymentBadge status={statusFilter} /> <Link href={filterHref(null)} className="ml-2 underline">limpar</Link></p>
      )}

      {visible.length === 0 ? (
        <EmptyState>Nenhum paciente encontrado.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Paciente</th><th>Valor</th><th className="hidden md:table-cell">Vencimento</th><th className="hidden lg:table-cell">Pagamento</th><th>Status</th></tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/pacientes/${r.id}?tab=financeiro`} className="flex items-center gap-3">
                      <Avatar name={r.fullName} />
                      <span>
                        <span className="block font-medium hover:underline">{r.fullName}</span>
                        <span className="block text-xs text-mist-500">{r.plan ?? '—'}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">{brl(r.amount)}</td>
                  <td className="hidden md:table-cell">{fmtDate(r.dueDate)}</td>
                  <td className="hidden lg:table-cell text-xs text-mist-500">{r.paidAt ? `${fmtDate(r.paidAt)}${r.method ? ` · ${r.method}` : ''}` : '—'}</td>
                  <td><PaymentStatusControl patientId={r.id} year={year} month={month} status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
