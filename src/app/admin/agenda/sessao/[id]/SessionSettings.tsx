'use client';
import { useState } from 'react';
import { useApiAction } from '@/components/useApiAction';
import { FormMessage } from '@/components/ui';

export function SessionSettings({
  sessionId, capacity, notes, patients, disabled,
}: { sessionId: string; capacity: number; notes: string; patients: { id: string; fullName: string }[]; disabled: boolean }) {
  const add = useApiAction();
  const upd = useApiAction();
  const [patientId, setPatientId] = useState('');
  const [cap, setCap] = useState(capacity);
  const [note, setNote] = useState(notes);

  return (
    <div className="space-y-4">
      <form
        className="card card-pad space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!patientId) return;
          if (await add.run(`/api/admin/sessions/${sessionId}/bookings`, { body: { patientId } })) setPatientId('');
        }}
      >
        <h3 className="text-lg font-semibold">Adicionar paciente</h3>
        <select className="input" value={patientId} onChange={(e) => setPatientId(e.target.value)} disabled={disabled}>
          <option value="">Selecione…</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
        </select>
        <FormMessage error={add.error} message={add.message} />
        <button className="btn-primary w-full" disabled={disabled || add.pending || !patientId}>Adicionar</button>
      </form>
      <form
        className="card card-pad space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void upd.run(`/api/admin/sessions/${sessionId}`, { method: 'PATCH', body: { capacity: Number(cap), notes: note } });
        }}
      >
        <h3 className="text-lg font-semibold">Configurações</h3>
        <div>
          <label className="label">Limite de alunos</label>
          <input type="number" min={1} max={50} className="input" value={cap} onChange={(e) => setCap(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Observações da aula</label>
          <textarea className="input" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <FormMessage error={upd.error} message={upd.message} />
        <button className="btn-secondary w-full" disabled={upd.pending}>Salvar</button>
      </form>
    </div>
  );
}
