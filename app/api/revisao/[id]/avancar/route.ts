import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { consumirSaldo } from '@/lib/quota';
import { getRevisao, getQuestoes, getRespostas, createQuestoes } from '@/lib/repos/revisoes';
import { vincularMovimentoARevisao } from '@/lib/repos/movimentos';
import { comTransacao } from '@/lib/repos/transacao';
import { gerarQuestoesFocadas, ModoFocado } from '@/lib/llm';
import { QuestaoLLM } from '@/lib/types';

// O novo desafio consome crédito no commit, como a geração inicial: LLM falha →
// ROLLBACK devolve o crédito. A rota não decide o SQL, só o código HTTP.
type ResultadoAvancar = { status: 402 } | { status: 200; total: number };

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

    const resultado = await comTransacao(async (client): Promise<ResultadoAvancar> => {
      const saldo = await consumirSaldo(client, auth.contaId);
      if (saldo === null) return { status: 402 };
      const novasQuestoes = await gerarQuestoesFocadas(revisao.conteudo_texto, questoesErradas, modo);
      await createQuestoes(client, params.id, novasQuestoes, questoes.length + 1);
      await vincularMovimentoARevisao(client, auth.contaId, params.id);
      return { status: 200, total: questoes.length + novasQuestoes.length };
    });

    if (resultado.status === 402) {
      return NextResponse.json(
        { error: 'Você usou suas revisões. Resgate um token para continuar.' },
        { status: 402 },
      );
    }
    return NextResponse.json({ ok: true, total: resultado.total });
  } catch (err) {
    console.error('[POST /api/revisao/[id]/avancar] falha:', err);
    return NextResponse.json({ error: 'Não consegui falar com o professor. Tente novamente.' }, { status: 500 });
  }
}
