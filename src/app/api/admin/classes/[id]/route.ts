import { handler, ok, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireApiRole } from '@/lib/session';
import { classGroupUpdateSchema } from '@/lib/validation';
import { generateSessions, nextGenerationStart } from '@/lib/scheduling';
import { OCCUPYING_STATUSES } from '@/lib/constants';

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  await requireApiRole('ADMIN');
  const { id } = await params;
  const { generateWeeks, ...data } = await parseBody(req, classGroupUpdateSchema);

  const message = await prisma.$transaction(async (tx) => {
    await tx.classGroup.update({ where: { id }, data });
    const parts: string[] = ['Turma atualizada.'];
    if (data.capacity !== undefined || data.name !== undefined) {
      // Aplica às aulas futuras (a capacidade nunca fica abaixo dos já agendados).
      const future = await tx.session.findMany({
        where: { classGroupId: id, startsAt: { gt: new Date() } },
        include: { _count: { select: { bookings: { where: { status: { in: OCCUPYING_STATUSES } } } } } },
      });
      for (const s of future) {
        await tx.session.update({
          where: { id: s.id },
          data: {
            ...(data.name ? { title: data.name } : {}),
            ...(data.capacity !== undefined ? { capacity: Math.max(data.capacity, s._count.bookings) } : {}),
          },
        });
      }
    }
    if (generateWeeks) {
      const from = await nextGenerationStart(tx, id);
      const created = await generateSessions(tx, id, from, generateWeeks);
      parts.push(`${created} nova(s) aula(s) gerada(s).`);
    }
    return parts.join(' ');
  }, { timeout: 30_000 });
  return ok({ message });
});

/** Encerra a turma: desativa e cancela aulas futuras. */
export const DELETE = handler<{ id: string }>(async (_req, { params }) => {
  await requireApiRole('ADMIN');
  const { id } = await params;
  await prisma.$transaction(async (tx) => {
    await tx.classGroup.update({ where: { id }, data: { active: false } });
    const now = new Date();
    await tx.booking.updateMany({
      where: { session: { classGroupId: id, startsAt: { gt: now } }, status: { in: OCCUPYING_STATUSES } },
      data: { status: 'CANCELLED', cancelledAt: now },
    });
    await tx.session.updateMany({ where: { classGroupId: id, startsAt: { gt: now } }, data: { status: 'CANCELLED' } });
    await tx.enrollment.deleteMany({ where: { classGroupId: id } });
  });
  return ok({ message: 'Turma encerrada e aulas futuras canceladas.' });
});
