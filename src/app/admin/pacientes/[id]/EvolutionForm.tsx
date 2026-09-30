'use client';
import { useState } from 'react';
import { useApiAction } from '@/components/useApiAction';
import { FormMessage } from '@/components/ui';

export function EvolutionForm({ patientId, today }: { patientId: string; today: string }) {
  const { run, pending, error, message } = useApiAction();
  const blank = { date: today, evolutionNotes: '', painLevel: '', painLocation: '', posturalAssessment: '', observations: '', patientGuidance: '' };
  const [v, setV] = useState(blank);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  return (
    <form
      className="card card-pad space-y-3 lg:sticky lg:top-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run(`/api/admin/patients/${patientId}/evolutions`, {
          body: { ...v, painLevel: v.painLevel === '' ? null : Number(v.painLevel) },
        });
        if (ok) setV(blank);
      }}
    >
      <h2 className="text-xl font-semibold">Registrar evolução</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Data</label>
          <input type="date" className="input" value={v.date} max={today} onChange={set('date')} required />
        </div>
        <div>
          <label className="label">Dor (EVA 0–10)</label>
          <input type="number" min={0} max={10} className="input" value={v.painLevel} onChange={set('painLevel')} />
        </div>
      </div>
      {v.painLevel !== '' && (
        <div>
          <label className="label">Local da dor</label>
          <input className="input" maxLength={200} value={v.painLocation} onChange={set('painLocation')} placeholder="Ex: lombar, ombro direito" />
        </div>
      )}
      <div>
        <label className="label">Notas de evolução *</label>
        <textarea className="input" required maxLength={5000} value={v.evolutionNotes} onChange={set('evolutionNotes')} placeholder="Como foi a sessão, progresso, exercícios realizados…" />
      </div>
      <div>
        <label className="label">Avaliação postural</label>
        <textarea className="input" maxLength={3000} value={v.posturalAssessment} onChange={set('posturalAssessment')} />
      </div>
      <div>
        <label className="label">Observações fisioterapêuticas</label>
        <textarea className="input" maxLength={3000} value={v.observations} onChange={set('observations')} />
      </div>
      <div>
        <label className="label">Orientação ao paciente (visível no portal)</label>
        <textarea className="input" maxLength={2000} value={v.patientGuidance} onChange={set('patientGuidance')} />
      </div>
      <FormMessage error={error} message={message} />
      <button className="btn-primary w-full" disabled={pending}>Salvar registro</button>
    </form>
  );
}
