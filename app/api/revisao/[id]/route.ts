import { NextRequest, NextResponse } from 'next/server';
import { getSessaoComQuestoes } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const data = getSessaoComQuestoes(params.id);
  if (!data) {
    return NextResponse.json({ error: 'Essa revisão não existe mais.' }, { status: 404 });
  }
  return NextResponse.json(data);
}
