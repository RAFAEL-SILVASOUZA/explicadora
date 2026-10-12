import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getRevisaoCompleta, getScore } from '@/lib/repos/revisoes';
import { gerarVeredito } from '@/lib/llm';
import { QuestaoLLM } from '@/lib/types';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  try {
    const data = await getRevisaoCompleta(params.id, auth.contaId);
    if (!data) return NextResponse.json({ error: 'Essa revisão não existe mais.' }, { status: 404 });

    const { acertos, total } = await getScore(params.id);
    const percentual = total > 0 ? Math.round((acertos / total) * 100) : 0;
    const questoesErradas: QuestaoLLM[] = data.questoes
      .filter(q => data.respostas.some(r => r.questao_id === q.id && !r.correto))
      .map(q => ({
        tipo: q.tipo as QuestaoLLM['tipo'],
        enunciado: q.enunciado,
        opcoes: q.opcoes,
        resposta_correta: q.resposta_correta,
        dica: q.dica || '',
      }));

    const veredito = await gerarVeredito(acertos, total, questoesErradas);
    return NextResponse.json({ veredito, acertos, total, percentual });
  } catch (err) {
    console.error('[POST /api/revisao/[id]/finalizar] falha:', err);
    return NextResponse.json({ error: 'Não consegui falar com o professor. Tente novamente.' }, { status: 500 });
  }
}
