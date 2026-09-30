import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  // bcrypt gera um salt aleatório por senha (embutido no hash).
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Hash "fantasma" usado quando o usuário não existe, para que o tempo de resposta
// do login não revele se um e-mail/usuário está cadastrado.
export const DUMMY_HASH = bcrypt.hashSync('cativar-dummy-password', ROUNDS);
