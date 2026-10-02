import { NextRequest, NextResponse } from 'next/server';
import { getSessao, getQuestoes, getRespostas, createQuestoesApos } from '@/lib/db';
import { gerarQuestoesFocadas, ModoFocado } from '@/lib/llm';
import { QuestaoLLM } from '@/lib/types';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessao = getSessao(params.id);
    if (!sessao) {
      return NextResponse.json({ error: 'Essa revisão não existe mais.' }, { status: 404 });
    }

    const questoes = getQuestoes(params.id);
    const respostas = getRespostas(params.id);

    const questoesErradas: QuestaoLLM[] = [];
    for (const q of questoes) {
      const r = respostas.find(r => r.questao_id === q.id);
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

    // Acertou tudo? Próximo nível (mais difícil). Senão, foco nos erros.
    const modo: ModoFocado = questoesErradas.length === 0 ? 'proximo_nivel' : 'foco_nos_erros';

    const novasQuestoes = await gerarQuestoesFocadas(sessao.conteudo_texto, questoesErradas, modo);

    // Ordem continuada: as novas vêm depois das existentes.
    const ordemInicial = questoes.length + 1;
    createQuestoesApos(params.id, novasQuestoes, ordemInicial);

    return NextResponse.json({ ok: true, total: questoes.length + novasQuestoes.length });
  } catch (err: any) {
    console.error('[POST /api/revisao/[id]/avancar] falha:', err);
    return NextResponse.json({ error: 'Não consegui falar com o professor. Tente novamente.' }, { status: 500 });
  }
}
