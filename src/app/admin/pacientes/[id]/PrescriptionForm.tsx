'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useApiAction } from '@/components/useApiAction';
import { FormMessage } from '@/components/ui';
import { APPARATUS, type Apparatus } from '@/lib/constants';

type Item = { apparatus: Apparatus; exerciseName: string; sets: string; reps: string; load: string; notes: string };
const newItem = (apparatus: Apparatus = 'REFORMER'): Item => ({ apparatus, exerciseName: '', sets: '', reps: '', load: '', notes: '' });

export function PrescriptionForm({ patientId, library }: { patientId: string; library: { name: string; apparatus: string }[] }) {
  const { run, pending, error, message } = useApiAction();
  const [open, setOpen] = useState(false);
  const [head, setHead] = useState({ title: '', frequency: '', homeGuidance: '' });
  const [items, setItems] = useState<Item[]>([newItem()]);
  const update = (i: number, k: keyof Item, value: string) => setItems(items.map((it, j) => (j === i ? { ...it, [k]: value } : it)));

  if (!open) {
    return (
      <div className="space-y-2">
        <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Nova prescrição de exercícios</button>
        <FormMessage message={message} />
      </div>
    );
  }

  return (
    <form
      className="card card-pad space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run(`/api/admin/patients/${patientId}/prescriptions`, {
          body: { ...head, items: items.map((it) => ({ ...it, sets: it.sets === '' ? null : Number(it.sets) })) },
        });
        if (ok) {
          setOpen(false);
          setHead({ title: '', frequency: '', homeGuidance: '' });
          setItems([newItem()]);
        }
      }}
    >
      <h2 className="text-xl font-semibold">Nova prescrição</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Título *</label>
          <input className="input" required maxLength={120} value={head.title} onChange={(e) => setHead({ ...head, title: e.target.value })} placeholder="Ex: Estabilização lombar — fase 1" />
        </div>
        <div>
          <label className="label">Frequência</label>
          <input className="input" maxLength={100} value={head.frequency} onChange={(e) => setHead({ ...head, frequency: e.target.value })} placeholder="Ex: 2x/semana" />
        </div>
      </div>

      <div className="space-y-3">
        <p className="label">Exercícios por aparelho / modalidade</p>
        {items.map((it, i) => {
          const listId = `ex-${i}`;
          return (
            <div key={i} className="grid gap-2 rounded-xl bg-sand-50 p-3 dark:bg-mist-800 sm:grid-cols-12">
              <select className="input sm:col-span-2" value={it.apparatus} onChange={(e) => update(i, 'apparatus', e.target.value)}>
                {Object.entries(APPARATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input className="input sm:col-span-3" list={listId} required maxLength={120} placeholder="Exercício" value={it.exerciseName} onChange={(e) => update(i, 'exerciseName', e.target.value)} />
              <datalist id={listId}>
                {library.filter((l) => l.apparatus === it.apparatus).map((l) => <option key={l.name} value={l.name} />)}
              </datalist>
              <input className="input sm:col-span-1" type="number" min={1} max={20} placeholder="Séries" value={it.sets} onChange={(e) => update(i, 'sets', e.target.value)} />
              <input className="input sm:col-span-1" maxLength={40} placeholder="Rep." value={it.reps} onChange={(e) => update(i, 'reps', e.target.value)} />
              <input className="input sm:col-span-2" maxLength={60} placeholder="Molas / carga" value={it.load} onChange={(e) => update(i, 'load', e.target.value)} />
              <input className="input sm:col-span-2" maxLength={300} placeholder="Observação" value={it.notes} onChange={(e) => update(i, 'notes', e.target.value)} />
              <button type="button" className="btn-ghost sm:col-span-1" aria-label="Remover exercício" disabled={items.length === 1} onClick={() => setItems(items.filter((_, j) => j !== i))}>
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
        <button type="button" className="btn-secondary btn-sm" onClick={() => setItems([...items, newItem(items.at(-1)?.apparatus)])}>
          <Plus size={14} /> Adicionar exercício
        </button>
      </div>

      <div>
        <label className="label">Orientações / rotina para casa (visível ao paciente)</label>
        <textarea className="input" maxLength={3000} value={head.homeGuidance} onChange={(e) => setHead({ ...head, homeGuidance: e.target.value })} />
      </div>
      <FormMessage error={error} />
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>Salvar prescrição</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </form>
  );
}
