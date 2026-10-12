import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getRevisaoCompleta, createResposta } from '@/lib/repos/revisoes';
import { avaliarResposta } from '@/lib/llm';
import { QuestaoLLM } from '@/lib/types';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  try {
    const body = await req.json();
    const { questaoId, resposta, imagem } = body as { questaoId: number; resposta: string; imagem?: string };

    const data = await getRevisaoCompleta(params.id, auth.contaId);
    if (!data) return NextResponse.json({ error: 'Essa revisão não existe mais.' }, { status: 404 });

    const questao = data.questoes.find(q => q.id === questaoId);
    if (!questao) return NextResponse.json({ error: 'Questão não encontrada.' }, { status: 404 });

    const questaoLLM: QuestaoLLM = {
      tipo: questao.tipo as QuestaoLLM['tipo'],
      enunciado: questao.enunciado,
      opcoes: questao.opcoes,
      resposta_correta: questao.resposta_correta,
      dica: questao.dica || '',
    };

    const { correto, explicacao } = await avaliarResposta(questaoLLM, resposta, imagem);
    await createResposta(questao.id, resposta, correto, explicacao);

    const indiceAtual = data.questoes.findIndex(q => q.id === questaoId);
    return NextResponse.json({
      correto, explicacao,
      questaoAtual: indiceAtual + 1,
      questoesRestantes: data.questoes.length - indiceAtual - 1,
    });
  } catch (err) {
    console.error('[POST /api/revisao/[id]/responder] falha:', err);
    return NextResponse.json({ error: 'Não consegui falar com o professor. Tente novamente.' }, { status: 500 });
  }
}
