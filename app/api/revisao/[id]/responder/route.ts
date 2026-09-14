import { NextRequest, NextResponse } from 'next/server';
import { getSessaoComQuestoes, createResposta, getQuestoes } from '@/lib/db';
import { avaliarResposta } from '@/lib/llm';
import { QuestaoLLM } from '@/lib/types';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { questaoId, resposta, imagem } = body as { questaoId: number; resposta: string; imagem?: string };

    const data = getSessaoComQuestoes(params.id);
    if (!data) {
      return NextResponse.json({ error: 'Essa revisão não existe mais.' }, { status: 404 });
    }

    const questao = data.questoes.find(q => q.id === questaoId);
    if (!questao) {
      return NextResponse.json({ error: 'Questão não encontrada.' }, { status: 404 });
    }

    const questaoLLM: QuestaoLLM = {
      tipo: questao.tipo as QuestaoLLM['tipo'],
      enunciado: questao.enunciado,
      opcoes: JSON.parse(questao.opcoes_json),
      resposta_correta: questao.resposta_correta,
      dica: questao.dica || '',
    };

    const { correto, explicacao } = await avaliarResposta(questaoLLM, resposta, imagem);
    createResposta(String(questao.id), resposta, correto, explicacao);

    const questoes = getQuestoes(params.id);
    const indiceAtual = questoes.findIndex(q => q.id === questaoId);
    const questoesRestantes = questoes.length - indiceAtual - 1;

    return NextResponse.json({
      correto,
      explicacao,
      questaoAtual: indiceAtual + 1,
      questoesRestantes,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Não consegui falar com o professor. Tente novamente.' }, { status: 500 });
  }
}
