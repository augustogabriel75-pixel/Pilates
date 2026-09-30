'use client';
import { useState } from 'react';
import clsx from 'clsx';

export function PatientPicker({
  patients, selected, onChange, max,
}: { patients: { id: string; fullName: string }[]; selected: string[]; onChange: (ids: string[]) => void; max: number }) {
  const [q, setQ] = useState('');
  const list = patients.filter((p) => p.fullName.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : selected.length < max ? [...selected, id] : selected);

  return (
    <div>
      <label className="label">Pacientes ({selected.length}/{max})</label>
      <input className="input mb-2" placeholder="Buscar paciente…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
        {list.map((p) => {
          const on = selected.includes(p.id);
          return (
            <button
              type="button"
              key={p.id}
              onClick={() => toggle(p.id)}
              className={clsx(
                'rounded-full border px-3 py-1 text-xs transition',
                on ? 'border-copper-500 bg-copper-500 text-white' : 'border-sand-300 hover:bg-sand-100 dark:border-mist-700 dark:hover:bg-mist-800',
                !on && selected.length >= max && 'opacity-40',
              )}
            >
              {p.fullName}
            </button>
          );
        })}
        {list.length === 0 && <p className="text-xs text-mist-500">Nenhum paciente encontrado.</p>}
      </div>
    </div>
  );
}
