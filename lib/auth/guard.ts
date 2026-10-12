import { NextRequest, NextResponse } from 'next/server';
import { verificarToken } from './jwt';
import { Role } from '../types';

export interface Auth {
  contaId: string;
  role: Role;
}

export async function autenticar(req: NextRequest): Promise<Auth | null> {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const payload = verificarToken(header.slice(7).trim());
  if (!payload) return null;
  return { contaId: payload.sub, role: payload.role };
}

export function naoAutorizado(): NextResponse {
  return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 });
}

export function naoAdministrador(): NextResponse {
  return NextResponse.json({ error: 'Essa área é só do administrador.' }, { status: 403 });
}
