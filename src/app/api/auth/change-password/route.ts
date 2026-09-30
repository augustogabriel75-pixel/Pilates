import { handler, ok, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { changePasswordSchema } from '@/lib/validation';
import { hashPassword, verifyPassword } from '@/lib/password';
import { HttpError } from '@/lib/errors';

export const POST = handler(async (req) => {
  const current = await getCurrentUser();
  if (!current) throw new HttpError(401, 'Não autenticado.');
  const { currentPassword, newPassword } = await parseBody(req, changePasswordSchema);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: current.id } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw new HttpError(400, 'Senha atual incorreta.');
  if (currentPassword === newPassword) throw new HttpError(400, 'A nova senha deve ser diferente da atual.');
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
  return ok({ message: 'Senha alterada com sucesso.' });
});
