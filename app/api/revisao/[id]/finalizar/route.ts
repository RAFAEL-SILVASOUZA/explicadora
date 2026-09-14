import { NextRequest, NextResponse } from 'next/server';
import { getSessaoComQuestoes, getScore } from '@/lib/db';
import { gerarVeredito } from '@/lib/llm';
import { QuestaoLLM } from '@/lib/types';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data = getSessaoComQuestoes(params.id);
    if (!data) {
      return NextResponse.json({ error: 'Essa revisão não existe mais.' }, { status: 404 });
    }

    const { acertos, total } = getScore(params.id);
    const percentual = total > 0 ? Math.round((acertos / total) * 100) : 0;

    const questoesErradas: QuestaoLLM[] = [];
    for (const q of data.questoes) {
      const r = data.respostas.find(r => r.questao_id === q.id);
      if (r && !r.correto) {
        questoesErradas.push({
          tipo: q.tipo as QuestaoLLM['tipo'],
          enunciado: q.enunciado,
          opcoes: JSON.parse(q.opcoes_json),
          resposta_correta: q.resposta_correta,
          dica: q.dica || '',
        });
      }
    }

    const veredito = await gerarVeredito(acertos, total, questoesErradas);

    return NextResponse.json({ veredito, acertos, total, percentual });
  } catch (err: any) {
    return NextResponse.json({ error: 'Não consegui falar com o professor. Tente novamente.' }, { status: 500 });
  }
}
