'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { useApiAction } from '@/components/useApiAction';
import { FormMessage } from '@/components/ui';
import { MODALITIES, WEEKDAYS_SHORT, type Modality } from '@/lib/constants';

interface Group {
  id: string; name: string; modality: string; weekdays: number[]; startTime: string; durationMin: number;
  capacity: number; instructor: string | null; lastSession: string | null; enrolled: { id: string; fullName: string }[];
}

export function ClassCard({ group, patients }: { group: Group; patients: { id: string; fullName: string }[] }) {
  const { run, pending, error, message } = useApiAction();
  const [patientId, setPatientId] = useState('');
  const [capacity, setCapacity] = useState(group.capacity);
  const [weeks, setWeeks] = useState(4);
  const base = `/api/admin/classes/${group.id}`;
  const enrolledIds = new Set(group.enrolled.map((e) => e.id));
  const full = group.enrolled.length >= group.capacity;

  return (
    <div className="card card-pad space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">{group.name}</h3>
          <p className="text-sm text-mist-500">
            {group.weekdays.map((d) => WEEKDAYS_SHORT[d]).join(', ')} · {group.startTime} · {group.durationMin} min · {MODALITIES[group.modality as Modality]}
          </p>
          {group.instructor && <p className="text-xs text-mist-500">Instrutor(a): {group.instructor}</p>}
          <p className="text-xs text-mist-500">Agenda gerada até {group.lastSession ?? '—'}</p>
        </div>
        <span className="badge bg-sand-100 text-sand-800 dark:bg-mist-800 dark:text-sand-200">{group.enrolled.length}/{group.capacity}</span>
      </div>

      <div>
        <p className="label">Alunos fixos</p>
        <ul className="flex flex-wrap gap-2">
          {group.enrolled.map((p) => (
            <li key={p.id} className="flex items-center gap-1 rounded-full bg-sand-100 py-1 pl-3 pr-1 text-xs dark:bg-mist-800">
              {p.fullName}
              <button
                className="rounded-full p-0.5 hover:bg-sand-200 dark:hover:bg-mist-700"
                title="Remover da turma"
                disabled={pending}
                onClick={() => window.confirm(`Remover ${p.fullName} da turma? Os agendamentos futuros serão cancelados.`) && run(`${base}/enrollments`, { method: 'DELETE', body: { patientId: p.id } })}
              >
                <X size={12} />
              </button>
            </li>
          ))}
          {group.enrolled.length === 0 && <li className="text-xs text-mist-500">Nenhum aluno fixo.</li>}
        </ul>
      </div>

      <div className="flex gap-2">
        <select className="input" value={patientId} onChange={(e) => setPatientId(e.target.value)} disabled={full}>
          <option value="">{full ? 'Turma completa' : 'Matricular paciente…'}</option>
          {patients.filter((p) => !enrolledIds.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
        </select>
        <button className="btn-primary" disabled={!patientId || pending} onClick={async () => { if (await run(`${base}/enrollments`, { body: { patientId } })) setPatientId(''); }}>
          Matricular
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex gap-2">
          <input type="number" min={1} max={50} className="input" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} aria-label="Limite de alunos" />
          <button className="btn-secondary" disabled={pending || capacity === group.capacity} onClick={() => run(base, { method: 'PATCH', body: { capacity } })}>Limite</button>
        </div>
        <div className="flex gap-2">
          <input type="number" min={1} max={26} className="input" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} aria-label="Semanas" />
          <button className="btn-secondary whitespace-nowrap" disabled={pending} onClick={() => run(base, { method: 'PATCH', body: { generateWeeks: weeks } })}>+ semanas</button>
        </div>
      </div>

      <FormMessage error={error} message={message} />
      <button
        className="btn-ghost btn-sm text-red-600"
        disabled={pending}
        onClick={() => window.confirm('Encerrar esta turma? As aulas futuras serão canceladas.') && run(base, { method: 'DELETE' })}
      >
        Encerrar turma
      </button>
    </div>
  );
}
