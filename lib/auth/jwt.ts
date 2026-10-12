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
    // Ruling UU: o algoritmo é fixado em HS256 (spec linha 33). Sem o pin, um token HS512
    // assinado com o mesmo segredo seria aceito.
    const payload = jwt.verify(token, segredo(), { algorithms: ['HS256'] }) as jwt.JwtPayload;
    if (!payload.sub) return null;
    if (payload.role !== 'user' && payload.role !== 'admin') return null;
    return { sub: String(payload.sub), role: payload.role };
  } catch {
    return null;
  }
}
