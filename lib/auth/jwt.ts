import jwt from 'jsonwebtoken';
import { Role } from '../types';

const EXPIRACAO_SEGUNDOS = 7 * 24 * 60 * 60;

function segredo(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET não está definido.');
  return s;
}

export function assinarToken(contaId: string, role: Role, expiraEm?: number): string {
  return jwt.sign({ sub: contaId, role }, segredo(), { expiresIn: expiraEm ?? EXPIRACAO_SEGUNDOS });
}

export function verificarToken(token: string): { sub: string; role: Role } | null {
  try {
    const payload = jwt.verify(token, segredo()) as jwt.JwtPayload;
    return { sub: String(payload.sub), role: payload.role as Role };
  } catch {
    return null;
  }
}
