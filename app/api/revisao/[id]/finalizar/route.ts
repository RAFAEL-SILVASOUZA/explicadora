import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getRevisaoCompleta, getResultadoCacheado, getScore, salvarVeredito } from '@/lib/repos/revisoes';
import { gerarVeredito } from '@/lib/llm';
import { QuestaoLLM } from '@/lib/types';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  try {
    const data = await getRevisaoCompleta(params.id, auth.contaId);
    if (!data) return NextResponse.json({ error: 'Essa revisão não existe mais.' }, { status: 404 });

    // O veredito já foi gerado nesta revisão: devolve o guardado, sem chamar a LLM de novo.
    const cacheado = await getResultadoCacheado(params.id, auth.contaId);
    if (cacheado?.veredito) return NextResponse.json(cacheado);

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
    await salvarVeredito(params.id, veredito);
    return NextResponse.json({ veredito, acertos, total, percentual });
  } catch (err) {
    console.error('[POST /api/revisao/[id]/finalizar] falha:', err);
    return NextResponse.json({ error: 'Não consegui falar com o professor. Tente novamente.' }, { status: 500 });
  }
}
