import Link from 'next/link';
import clsx from 'clsx';
import { prisma } from '@/lib/prisma';
import { requirePageRole } from '@/lib/session';
import { brl } from '@/lib/format';
import { Avatar, EmptyState, PageHeader } from '@/components/ui';

export const metadata = { title: 'Pacientes' };

export default async function PacientesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requirePageRole('ADMIN');
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 80);
  const status = sp.status === 'inactive' ? 'inactive' : 'active';
  const patients = await prisma.patient.findMany({
    where: { active: status === 'active', ...(q ? { OR: [{ fullName: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }] } : {}) },
    orderBy: { fullName: 'asc' },
    include: { user: { select: { active: true } }, _count: { select: { enrollments: true } } },
  });

  return (
    <>
      <PageHeader title="Pacientes" subtitle={`${patients.length} paciente(s)`} actions={<Link href="/admin/pacientes/novo" className="btn-primary">+ Novo paciente</Link>} />
      <form className="mb-4 flex flex-col gap-2 sm:flex-row" action="/admin/pacientes">
        <input name="q" defaultValue={q} placeholder="Buscar por nome, telefone ou e-mail…" className="input" maxLength={80} />
        <select name="status" defaultValue={status} className="input sm:w-44">
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
        <button className="btn-secondary">Filtrar</button>
      </form>
      {patients.length === 0 ? (
        <EmptyState>Nenhum paciente encontrado.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Paciente</th><th className="hidden md:table-cell">Plano</th><th className="hidden sm:table-cell">Mensalidade</th><th className="hidden lg:table-cell">Turmas</th><th>Portal</th></tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-sand-50 dark:hover:bg-mist-850">
                  <td>
                    <Link href={`/admin/pacientes/${p.id}`} className="flex items-center gap-3">
                      <Avatar name={p.fullName} />
                      <span>
                        <span className="block font-medium hover:underline">{p.fullName}</span>
                        <span className="block text-xs text-mist-500">{p.phone ?? p.email ?? '—'}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="hidden md:table-cell">{p.plan ?? '—'}</td>
                  <td className="hidden sm:table-cell">{brl(p.monthlyFee)} <span className="text-xs text-mist-500">dia {p.dueDay}</span></td>
                  <td className="hidden lg:table-cell">{p._count.enrollments}</td>
                  <td>
                    <span className={clsx('badge', p.user?.active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-mist-100 text-mist-600 dark:bg-mist-800 dark:text-mist-300')}>
                      {p.user ? (p.user.active ? 'Ativo' : 'Bloqueado') : 'Sem acesso'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
