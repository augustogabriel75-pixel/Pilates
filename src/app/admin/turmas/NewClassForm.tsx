'use client';
import { useState } from 'react';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import { useApiAction } from '@/components/useApiAction';
import { FormMessage } from '@/components/ui';
import { MODALITIES, WEEKDAYS_SHORT } from '@/lib/constants';
import { PatientPicker } from '../PatientPicker';

const initial = (today: string) => ({
  name: 'Pilates Aparelho', modality: 'PILATES_APARELHO', startTime: '08:00', durationMin: 50, capacity: 3,
  instructor: '', startDate: today, weeks: 8,
});

export function NewClassForm({ patients, today }: { patients: { id: string; fullName: string }[]; today: string }) {
  const [open, setOpen] = useState(false);
  const { run, pending, error, message } = useApiAction();
  const [form, setForm] = useState(initial(today));
  const [weekdays, setWeekdays] = useState<number[]>([1, 3]);
  const [selected, setSelected] = useState<string[]>([]);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  if (!open) {
    return (
      <div className="space-y-2">
        <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Nova turma recorrente</button>
        <FormMessage message={message} />
      </div>
    );
  }

  return (
    <form
      className="card card-pad space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run('/api/admin/classes', {
          body: {
            ...form, weekdays, patientIds: selected,
            durationMin: Number(form.durationMin), capacity: Number(form.capacity), weeks: Number(form.weeks),
          },
        });
        if (ok) {
          setOpen(false);
          setForm(initial(today));
          setSelected([]);
        }
      }}
    >
      <h2 className="text-xl font-semibold">Nova turma recorrente</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label">Nome da turma</label>
          <input className="input" value={form.name} onChange={set('name')} required maxLength={80} />
        </div>
        <div>
          <label className="label">Modalidade</label>
          <select className="input" value={form.modality} onChange={set('modality')}>
            {Object.entries(MODALITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Instrutor(a)</label>
          <input className="input" value={form.instructor} onChange={set('instructor')} maxLength={80} />
        </div>
      </div>
      <div>
        <label className="label">Dias da semana</label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS_SHORT.map((d, i) => (
            <button
              type="button"
              key={d}
              onClick={() => setWeekdays(weekdays.includes(i) ? weekdays.filter((x) => x !== i) : [...weekdays, i])}
              className={clsx('h-10 w-12 rounded-xl border text-sm font-medium', weekdays.includes(i) ? 'border-copper-500 bg-copper-500 text-white' : 'border-sand-300 dark:border-mist-700')}
            >
              {d}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-mist-500">{weekdays.length}x por semana</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div>
          <label className="label">Horário</label>
          <input type="time" className="input" value={form.startTime} onChange={set('startTime')} required />
        </div>
        <div>
          <label className="label">Duração (min)</label>
          <input type="number" min={15} max={240} className="input" value={form.durationMin} onChange={set('durationMin')} />
        </div>
        <div>
          <label className="label">Limite de alunos</label>
          <input type="number" min={1} max={50} className="input" value={form.capacity} onChange={set('capacity')} />
        </div>
        <div>
          <label className="label">Início</label>
          <input type="date" className="input" value={form.startDate} min={today} onChange={set('startDate')} />
        </div>
        <div>
          <label className="label">Gerar semanas</label>
          <input type="number" min={1} max={26} className="input" value={form.weeks} onChange={set('weeks')} />
        </div>
      </div>
      <PatientPicker patients={patients} selected={selected} onChange={setSelected} max={Number(form.capacity) || 1} />
      <FormMessage error={error} />
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? 'Criando…' : 'Criar turma e gerar agenda'}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </form>
  );
}
