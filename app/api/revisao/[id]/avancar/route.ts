import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getPool } from '@/lib/db/pool';
import { getRevisao, getQuestoes, getRespostas, createQuestoes } from '@/lib/repos/revisoes';
import { gerarQuestoesFocadas, ModoFocado } from '@/lib/llm';
import { QuestaoLLM } from '@/lib/types';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  try {
    const revisao = await getRevisao(params.id, auth.contaId);
    if (!revisao) return NextResponse.json({ error: 'Essa revisão não existe mais.' }, { status: 404 });

    const questoes = await getQuestoes(params.id);
    const respostas = await getRespostas(params.id);
    const questoesErradas = questoes
      .filter(q => respostas.some(r => r.questao_id === q.id && !r.correto))
      .map(q => ({
        tipo: q.tipo as QuestaoLLM['tipo'],
        enunciado: q.enunciado,
        opcoes: q.opcoes,
        resposta_correta: q.resposta_correta,
        dica: q.dica || '',
      }));

    const modo: ModoFocado = questoesErradas.length === 0 ? 'proximo_nivel' : 'foco_nos_erros';
    const novasQuestoes = await gerarQuestoesFocadas(revisao.conteudo_texto, questoesErradas, modo);
    await createQuestoes(getPool(), params.id, novasQuestoes, questoes.length + 1);

    return NextResponse.json({ ok: true, total: questoes.length + novasQuestoes.length });
  } catch (err) {
    console.error('[POST /api/revisao/[id]/avancar] falha:', err);
    return NextResponse.json({ error: 'Não consegui falar com o professor. Tente novamente.' }, { status: 500 });
  }
}
