import { NextResponse } from 'next/server';
import { listarSessoes } from '@/lib/db';

export async function GET() {
  const sessoes = listarSessoes();
  return NextResponse.json(sessoes);
}
