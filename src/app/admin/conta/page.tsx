import { ChangePasswordForm } from '@/components/ChangePasswordForm';
import { PageHeader } from '@/components/ui';
import { requirePageRole } from '@/lib/session';

export const metadata = { title: 'Minha conta' };

export default async function Page() {
  const user = await requirePageRole('ADMIN');
  return (
    <>
      <PageHeader title="Minha conta" subtitle={`${user.name} · ${user.email}`} />
      <ChangePasswordForm />
    </>
  );
}
