import Link from 'next/link';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requirePageRole } from '@/lib/session';
import { addMonths, ageFrom, fmtDate, fmtDateTime, toDateStr, todayStr } from '@/lib/dates';
import { APPARATUS, MONTHS, type Apparatus } from '@/lib/constants';
import { effectiveStatus } from '@/lib/payments';
import { brl } from '@/lib/format';
import { Avatar, BookingBadge, EmptyState, PaymentBadge } from '@/components/ui';
import { ActionButton } from '@/components/ActionButton';
import { PatientForm } from '../PatientForm';
import { EvolutionForm } from './EvolutionForm';
import { PrescriptionForm } from './PrescriptionForm';
import { PaymentStatusControl } from '../../financeiro/PaymentStatusControl';

const TABS = [
  { key: 'evolucao', label: 'Prontuário' },
  { key: 'exercicios', label: 'Exercícios' },
  { key: 'aulas', label: 'Aulas' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'cadastro', label: 'Cadastro' },
] as const;
type Tab = (typeof TABS)[number]['key'];

export default async function PatientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  await requirePageRole('ADMIN');
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = (TABS.find((t) => t.key === sp.tab)?.key ?? 'evolucao') as Tab;

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: { user: { select: { email: true, active: true, lastLoginAt: true } }, enrollments: { include: { classGroup: true } } },
  });
  if (!patient) notFound();
  const age = ageFrom(patient.birthDate);

  return (
    <>
      <Link href="/admin/pacientes" className="btn-ghost btn-sm mb-2 -ml-2"><ChevronLeft size={16} /> Pacientes</Link>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar name={patient.fullName} />
        <div className="flex-1">
          <h1 className="text-3xl font-semibold">{patient.fullName}</h1>
          <p className="text-sm text-mist-500">
            {[age !== null ? `${age} anos` : null, patient.plan, patient.phone].filter(Boolean).join(' · ')}
            {!patient.active && <span className="badge ml-2 bg-mist-200 text-mist-700">Inativo</span>}
          </p>
        </div>
      </div>

      {(patient.medicalHistory || patient.goals) && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {patient.medicalHistory && <div className="card card-pad"><p className="label">Histórico clínico</p><p className="whitespace-pre-line text-sm">{patient.medicalHistory}</p></div>}
          {patient.goals && <div className="card card-pad"><p className="label">Objetivos</p><p className="whitespace-pre-line text-sm">{patient.goals}</p></div>}
        </div>
      )}

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-white/70 p-1 dark:bg-mist-900">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/pacientes/${id}?tab=${t.key}`} className={clsx('tab', tab === t.key && 'tab-active')}>{t.label}</Link>
        ))}
      </nav>

      {tab === 'evolucao' && <EvolutionTab patientId={id} />}
      {tab === 'exercicios' && <ExercisesTab patientId={id} />}
      {tab === 'aulas' && <ClassesTab patientId={id} enrollments={patient.enrollments.map((e) => e.classGroup.name)} />}
      {tab === 'financeiro' && <FinanceTab patientId={id} dueDay={patient.dueDay} fee={patient.monthlyFee} />}
      {tab === 'cadastro' && (
        <div className="space-y-4">
          {patient.user && (
            <div className="card card-pad flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Portal do paciente: {patient.user.active ? 'ativo' : 'bloqueado'}</p>
                <p className="text-sm text-mist-500">Login: {patient.user.email} · Último acesso: {patient.user.lastLoginAt ? fmtDateTime(patient.user.lastLoginAt) : 'nunca'}</p>
              </div>
              <ActionButton url={`/api/admin/patients/${id}`} method="PATCH" body={{ accessActive: !patient.user.active }} className={patient.user.active ? 'btn-danger btn-sm' : 'btn-success btn-sm'}>
                {patient.user.active ? 'Bloquear acesso' : 'Desbloquear acesso'}
              </ActionButton>
            </div>
          )}
          <PatientForm
            id={id}
            hasAccess={!!patient.user}
            accessEmail={patient.user?.email ?? ''}
            initial={{
              fullName: patient.fullName, email: patient.email ?? '', phone: patient.phone ?? '', cpf: patient.cpf ?? '',
              birthDate: patient.birthDate ? toDateStr(patient.birthDate) : '', address: patient.address ?? '',
              emergencyContact: patient.emergencyContact ?? '', profession: patient.profession ?? '',
              medicalHistory: patient.medicalHistory ?? '', medications: patient.medications ?? '', goals: patient.goals ?? '',
              plan: patient.plan ?? '', monthlyFee: patient.monthlyFee, dueDay: patient.dueDay, notes: patient.notes ?? '', active: patient.active,
            }}
          />
        </div>
      )}
    </>
  );
}

async function EvolutionTab({ patientId }: { patientId: string }) {
  const records = await prisma.evolutionRecord.findMany({
    where: { patientId },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: { author: { select: { name: true } } },
  });
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2"><EvolutionForm patientId={patientId} today={todayStr()} /></div>
      <div className="space-y-3 lg:col-span-3">
        <h2 className="text-2xl font-semibold">Histórico de evolução</h2>
        {records.length === 0 && <EmptyState>Nenhum registro ainda.</EmptyState>}
        {records.map((r) => (
          <article key={r.id} className="card card-pad space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{fmtDate(r.date)} <span className="text-xs font-normal text-mist-500">por {r.author?.name ?? '—'}</span></p>
              {r.painLevel !== null && (
                <span className="flex items-center gap-2 text-xs">
                  Dor {r.painLevel}/10{r.painLocation && ` · ${r.painLocation}`}
                  <span className="h-1.5 w-20 rounded-full bg-sand-100 dark:bg-mist-800">
                    <span className="block h-1.5 rounded-full" style={{ width: `${r.painLevel * 10}%`, background: r.painLevel >= 7 ? '#dc2626' : r.painLevel >= 4 ? '#c9a97a' : '#059669' }} />
                  </span>
                </span>
              )}
            </div>
            <p className="whitespace-pre-line text-sm">{r.evolutionNotes}</p>
            {r.posturalAssessment && <p className="text-sm"><span className="label inline">Avaliação postural: </span>{r.posturalAssessment}</p>}
            {r.observations && <p className="text-sm"><span className="label inline">Observações: </span>{r.observations}</p>}
            {r.patientGuidance && <p className="rounded-lg bg-sand-50 p-2 text-sm dark:bg-mist-800"><span className="label inline">Orientação ao paciente: </span>{r.patientGuidance}</p>}
            <ActionButton url={`/api/admin/evolutions/${r.id}`} method="DELETE" className="btn-ghost btn-sm text-red-600" confirm="Excluir este registro de evolução?">Excluir</ActionButton>
          </article>
        ))}
      </div>
    </div>
  );
}

async function ExercisesTab({ patientId }: { patientId: string }) {
  const [prescriptions, library] = await Promise.all([
    prisma.prescription.findMany({ where: { patientId }, orderBy: [{ active: 'desc' }, { createdAt: 'desc' }], include: { items: { orderBy: { order: 'asc' } } } }),
    prisma.exercise.findMany({ orderBy: { name: 'asc' }, select: { name: true, apparatus: true } }),
  ]);
  return (
    <div className="space-y-6">
      <PrescriptionForm patientId={patientId} library={library} />
      {prescriptions.length === 0 && <EmptyState>Nenhuma prescrição.</EmptyState>}
      {prescriptions.map((p) => {
        const groups = new Map<string, typeof p.items>();
        for (const it of p.items) groups.set(it.apparatus, [...(groups.get(it.apparatus) ?? []), it]);
        return (
          <article key={p.id} className={clsx('card card-pad space-y-3', !p.active && 'opacity-60')}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-xl font-semibold">{p.title} {!p.active && <span className="badge bg-mist-100 text-mist-600">Arquivada</span>}</h3>
                <p className="text-xs text-mist-500">{fmtDate(p.createdAt)}{p.frequency && ` · ${p.frequency}`}</p>
              </div>
              <div className="flex gap-2">
                <ActionButton url={`/api/admin/prescriptions/${p.id}`} method="PATCH" body={{ active: !p.active }}>{p.active ? 'Arquivar' : 'Reativar'}</ActionButton>
                <ActionButton url={`/api/admin/prescriptions/${p.id}`} method="DELETE" className="btn-ghost btn-sm text-red-600" confirm="Excluir esta prescrição?">Excluir</ActionButton>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {[...groups].map(([app, items]) => (
                <div key={app} className="rounded-xl bg-sand-50 p-3 dark:bg-mist-800">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-copper-600 dark:text-sand-300">{APPARATUS[app as Apparatus] ?? app}</p>
                  <ul className="space-y-1.5 text-sm">
                    {items.map((it) => (
                      <li key={it.id}>
                        <span className="font-medium">{it.exerciseName}</span>
                        <span className="text-mist-500">{[it.sets && `${it.sets} série${it.sets > 1 ? "s" : ""}`, it.reps && `${it.reps} rep.`, it.load].filter(Boolean).map((x) => ` · ${x}`).join('')}</span>
                        {it.notes && <span className="block text-xs text-mist-500">{it.notes}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {p.homeGuidance && <p className="text-sm"><span className="label inline">Orientações para casa: </span>{p.homeGuidance}</p>}
          </article>
        );
      })}
    </div>
  );
}

async function ClassesTab({ patientId, enrollments }: { patientId: string; enrollments: string[] }) {
  const now = new Date();
  const [upcoming, past] = await Promise.all([
    prisma.booking.findMany({ where: { patientId, session: { startsAt: { gte: now } } }, include: { session: true }, orderBy: { session: { startsAt: 'asc' } }, take: 20 }),
    prisma.booking.findMany({ where: { patientId, session: { startsAt: { lt: now } } }, include: { session: true }, orderBy: { session: { startsAt: 'desc' } }, take: 30 }),
  ]);
  const attended = past.filter((b) => b.status === 'ATTENDED' || b.status === 'CHECKED_IN').length;
  const absent = past.filter((b) => b.status === 'ABSENT').length;
  const row = (b: (typeof past)[number]) => (
    <li key={b.id} className="flex items-center justify-between border-t border-sand-100 px-4 py-2.5 text-sm first:border-t-0 dark:border-mist-800">
      <Link href={`/admin/agenda/sessao/${b.sessionId}`} className="hover:underline">{fmtDateTime(b.session.startsAt)} · {b.session.title}</Link>
      <BookingBadge status={b.status} />
    </li>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <p className="text-sm">Turmas fixas: <strong>{enrollments.join(', ') || 'nenhuma'}</strong></p>
        <h2 className="text-2xl font-semibold">Próximas aulas</h2>
        {upcoming.length === 0 ? <EmptyState>Sem aulas futuras.</EmptyState> : <ul className="card">{upcoming.map(row)}</ul>}
      </div>
      <div className="space-y-3">
        <p className="text-sm">Presenças: <strong>{attended}</strong> · Faltas: <strong>{absent}</strong> (últimas 30 aulas)</p>
        <h2 className="text-2xl font-semibold">Histórico</h2>
        {past.length === 0 ? <EmptyState>Sem histórico.</EmptyState> : <ul className="card">{past.map(row)}</ul>}
      </div>
    </div>
  );
}

async function FinanceTab({ patientId, dueDay, fee }: { patientId: string; dueDay: number; fee: number }) {
  const today = todayStr();
  const months = Array.from({ length: 12 }, (_, i) => addMonths(today, -i)).map((d) => ({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) }));
  const payments = await prisma.payment.findMany({ where: { patientId } });
  const find = (y: number, m: number) => payments.find((p) => p.year === y && p.month === m);
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead><tr><th>Mês</th><th>Valor</th><th>Status</th><th className="hidden sm:table-cell">Pago em</th><th>Alterar</th></tr></thead>
        <tbody>
          {months.map(({ y, m }) => {
            const p = find(y, m);
            const st = effectiveStatus(p, y, m, dueDay);
            return (
              <tr key={`${y}-${m}`}>
                <td>{MONTHS[m - 1]}/{y}</td>
                <td>{brl(p?.amount ?? fee)}</td>
                <td><PaymentBadge status={st} /></td>
                <td className="hidden sm:table-cell">{p?.paidAt ? fmtDate(p.paidAt) : '—'}</td>
                <td><PaymentStatusControl patientId={patientId} year={y} month={m} status={st} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
