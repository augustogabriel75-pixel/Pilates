import { requirePageRole } from '@/lib/session';
import { PageHeader } from '@/components/ui';
import { PatientForm } from '../PatientForm';

export const metadata = { title: 'Novo paciente' };

export default async function NovoPacientePage() {
  await requirePageRole('ADMIN');
  return (
    <>
      <PageHeader title="Novo paciente" subtitle="Cadastro completo e, opcionalmente, acesso ao Portal do Paciente." />
      <PatientForm />
    </>
  );
}
