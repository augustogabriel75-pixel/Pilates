'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApiAction } from '@/components/useApiAction';
import { FormMessage } from '@/components/ui';

export interface PatientFormValues {
  fullName: string; email: string; phone: string; cpf: string; birthDate: string; address: string;
  emergencyContact: string; profession: string; medicalHistory: string; medications: string; goals: string;
  plan: string; monthlyFee: number; dueDay: number; notes: string; active: boolean;
}

const empty: PatientFormValues = {
  fullName: '', email: '', phone: '', cpf: '', birthDate: '', address: '', emergencyContact: '', profession: '',
  medicalHistory: '', medications: '', goals: '', plan: 'Pilates 2x/semana', monthlyFee: 0, dueDay: 10, notes: '', active: true,
};

export function PatientForm({ id, initial, hasAccess = false, accessEmail = '' }: { id?: string; initial?: PatientFormValues; hasAccess?: boolean; accessEmail?: string }) {
  const router = useRouter();
  const { run, pending, error, message } = useApiAction();
  const [v, setV] = useState<PatientFormValues>(initial ?? empty);
  const [withAccess, setWithAccess] = useState(false);
  const [access, setAccess] = useState({ email: accessEmail, password: '' });
  const set = (k: keyof PatientFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV({ ...v, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value });

  const field = (k: keyof PatientFormValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={k}>{label}</label>
      <input id={k} className="input" value={v[k] as string | number} onChange={set(k)} {...props} />
    </div>
  );
  const area = (k: keyof PatientFormValues, label: string, max = 2000) => (
    <div>
      <label className="label" htmlFor={k}>{label}</label>
      <textarea id={k} className="input" value={v[k] as string} onChange={set(k)} maxLength={max} />
    </div>
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...v, access: withAccess ? { email: access.email || v.email, password: access.password } : null };
    if (id) {
      const ok = await run(`/api/admin/patients/${id}`, { method: 'PATCH', body });
      if (ok) {
        setWithAccess(false);
        setAccess({ ...access, password: '' });
      }
    } else {
      const res = await run<{ id: string }>('/api/admin/patients', { body });
      if (res) router.push(`/admin/pacientes/${res.id}`);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="card card-pad space-y-4">
        <h2 className="text-xl font-semibold">Dados pessoais</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">{field('fullName', 'Nome completo *', { required: true, maxLength: 120 })}</div>
          {field('birthDate', 'Data de nascimento', { type: 'date' })}
          {field('phone', 'Telefone / WhatsApp', { maxLength: 30, inputMode: 'tel' })}
          {field('email', 'E-mail', { type: 'email', maxLength: 120 })}
          {field('cpf', 'CPF', { maxLength: 14, inputMode: 'numeric' })}
          <div className="sm:col-span-2">{field('address', 'Endereço', { maxLength: 250 })}</div>
          {field('profession', 'Profissão', { maxLength: 100 })}
          <div className="sm:col-span-2 lg:col-span-3">{field('emergencyContact', 'Contato de emergência', { maxLength: 150 })}</div>
        </div>
      </section>

      <section className="card card-pad space-y-4">
        <h2 className="text-xl font-semibold">Anamnese</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {area('medicalHistory', 'Histórico clínico / queixa principal', 4000)}
          {area('medications', 'Medicamentos em uso', 1000)}
          {area('goals', 'Objetivos', 1000)}
          {area('notes', 'Observações gerais', 2000)}
        </div>
      </section>

      <section className="card card-pad space-y-4">
        <h2 className="text-xl font-semibold">Plano e mensalidade</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {field('plan', 'Plano', { maxLength: 100, placeholder: 'Pilates 2x/semana' })}
          {field('monthlyFee', 'Mensalidade (R$)', { type: 'number', min: 0, step: '0.01' })}
          {field('dueDay', 'Dia de vencimento', { type: 'number', min: 1, max: 28 })}
        </div>
        {id && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} className="h-4 w-4 accent-copper-500" />
            Paciente ativo (inativar cancela agendamentos futuros e matrículas)
          </label>
        )}
      </section>

      <section className="card card-pad space-y-4">
        <h2 className="text-xl font-semibold">Acesso ao Portal do Paciente</h2>
        {hasAccess && <p className="text-sm text-mist-500">Este paciente já possui acesso ({accessEmail}). Marque abaixo para redefinir e-mail/senha.</p>}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={withAccess} onChange={(e) => setWithAccess(e.target.checked)} className="h-4 w-4 accent-copper-500" />
          {hasAccess ? 'Redefinir acesso' : 'Criar acesso ao portal'}
        </label>
        {withAccess && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">E-mail de login</label>
              <input type="email" className="input" required value={access.email || v.email} onChange={(e) => setAccess({ ...access, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Senha provisória</label>
              <input type="password" className="input" required minLength={8} autoComplete="new-password" value={access.password} onChange={(e) => setAccess({ ...access, password: e.target.value })} />
              <p className="mt-1 text-xs text-mist-500">Mín. 8 caracteres com letras e números. Oriente o paciente a trocá-la.</p>
            </div>
          </div>
        )}
      </section>

      <FormMessage error={error} message={message} />
      <button className="btn-primary px-8" disabled={pending}>{pending ? 'Salvando…' : id ? 'Salvar alterações' : 'Cadastrar paciente'}</button>
    </form>
  );
}
