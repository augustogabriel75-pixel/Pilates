import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requirePageRole } from '@/lib/session';
import { fmtDateLong, fmtTime, toDateStr } from '@/lib/dates';
import { MODALITIES, OCCUPYING_STATUSES, type BookingStatus, type Modality } from '@/lib/constants';
import { PageHeader } from '@/components/ui';
import { ActionButton } from '@/components/ActionButton';
import { AttendanceList } from '../../../presenca/AttendanceList';
import { SessionSettings } from './SessionSettings';

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole('ADMIN');
  const { id } = await params;
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      classGroup: { select: { id: true, name: true } },
      bookings: { include: { patient: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!session) notFound();

  const booked = new Set(session.bookings.filter((b) => OCCUPYING_STATUSES.includes(b.status as BookingStatus)).map((b) => b.patientId));
  const patients = await prisma.patient.findMany({
    where: { active: true, id: { notIn: [...booked] } },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  });
  const day = toDateStr(session.startsAt);

  return (
    <>
      <Link href={`/admin/agenda?view=day&date=${day}`} className="btn-ghost btn-sm mb-2 -ml-2"><ChevronLeft size={16} /> Agenda do dia</Link>
      <PageHeader
        title={session.title}
        subtitle={
          <span>
            {fmtDateLong(session.startsAt)} · {fmtTime(session.startsAt)}–{fmtTime(session.endsAt)} · {MODALITIES[session.modality as Modality] ?? session.modality}
            {session.classGroup && <> · turma <Link className="underline" href="/admin/turmas">{session.classGroup.name}</Link></>}
          </span>
        }
        actions={
          session.status === 'SCHEDULED' ? (
            <ActionButton url={`/api/admin/sessions/${id}`} method="PATCH" body={{ status: 'CANCELLED' }} className="btn-danger" confirm="Cancelar esta aula? Os alunos receberão crédito de reposição.">
              Cancelar aula
            </ActionButton>
          ) : (
            <ActionButton url={`/api/admin/sessions/${id}`} method="PATCH" body={{ status: 'SCHEDULED' }} className="btn-secondary">
              Reativar aula
            </ActionButton>
          )
        }
      />
      {session.status === 'CANCELLED' && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">Esta aula está cancelada.</p>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AttendanceList
            session={{
              id: session.id, title: session.title, startsAt: session.startsAt.toISOString(), capacity: session.capacity, status: session.status,
              bookings: session.bookings.map((b) => ({
                id: b.id, status: b.status, isMakeup: b.isMakeup, patientId: b.patient.id, patientName: b.patient.fullName,
                checkedInAt: b.checkedInAt ? fmtTime(b.checkedInAt) : null,
              })),
            }}
            showCancelled
          />
        </div>
        <SessionSettings sessionId={id} capacity={session.capacity} notes={session.notes ?? ''} patients={patients} disabled={session.status !== 'SCHEDULED'} />
      </div>
    </>
  );
}
