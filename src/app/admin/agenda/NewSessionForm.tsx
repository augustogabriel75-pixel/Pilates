'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useApiAction } from '@/components/useApiAction';
import { FormMessage } from '@/components/ui';
import { MODALITIES } from '@/lib/constants';
import { PatientPicker } from '../PatientPicker';

export function NewSessionForm({ patients, defaultDate }: { patients: { id: string; fullName: string }[]; defaultDate: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { run, pending, error } = useApiAction();
  const [form, setForm] = useState({
    title: 'Avaliação', modality: 'AVALIACAO', date: defaultDate, startTime: '09:00', durationMin: 60, capacity: 1,
  });
  const [selected, setSelected] = useState<string[]>([]);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus size={16} /> Nova aula avulsa
      </button>
    );
  }

  return (
    <form
      className="card card-pad space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run<{ id: string }>('/api/admin/sessions', {
          body: { ...form, durationMin: Number(form.durationMin), capacity: Number(form.capacity), patientIds: selected },
        });
        if (res) router.push(`/admin/agenda/sessao/${res.id}`);
      }}
    >
      <h2 className="text-xl font-semibold">Nova aula avulsa</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label">Título</label>
          <input className="input" value={form.title} onChange={set('title')} required maxLength={80} />
        </div>
        <div>
          <label className="label">Modalidade</label>
          <select className="input" value={form.modality} onChange={set('modality')}>
            {Object.entries(MODALITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Data</label>
          <input type="date" className="input" value={form.date} onChange={set('date')} required />
        </div>
        <div>
          <label className="label">Início</label>
          <input type="time" className="input" value={form.startTime} onChange={set('startTime')} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Minutos</label>
            <input type="number" min={15} max={240} className="input" value={form.durationMin} onChange={set('durationMin')} />
          </div>
          <div>
            <label className="label">Vagas</label>
            <input type="number" min={1} max={50} className="input" value={form.capacity} onChange={set('capacity')} />
          </div>
        </div>
      </div>
      <PatientPicker patients={patients} selected={selected} onChange={setSelected} max={Number(form.capacity)} />
      <FormMessage error={error} />
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>Criar aula</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </form>
  );
}
