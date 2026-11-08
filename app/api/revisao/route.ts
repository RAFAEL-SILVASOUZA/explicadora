import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { consumirSaldo } from '@/lib/quota';
import { criarRevisao, createQuestoes, getRevisaoPorChave } from '@/lib/repos/revisoes';
import { vincularMovimentoARevisao } from '@/lib/repos/movimentos';
import { comTransacao } from '@/lib/repos/transacao';
import { getPool } from '@/lib/db/pool';
import { gerarQuestoes } from '@/lib/llm';
import { MaterialInvalido, coletarMateriais } from '@/lib/uploads/materiais';

// O resultado da transação: 402 quando o saldo está esgotado, 200 quando a
// revisão foi criada. A rota não decide o SQL, só o código HTTP.
// `duplicate`: a mesma tentativa (mesma chave) já existia — devolve a revisão
// encontrada sem debitar de novo.
type ResultadoCriacao = { status: 402 } | { status: 200; id: string; saldo: number; duplicate?: boolean };

export async function POST(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  try {
    const formData = await req.formData();
    // O material vem de duas fontes: arquivos novos (que passam a ser guardados na
    // biblioteca da conta) e ids de itens já guardados (relidos do servidor, sem
    // reenvio). A coleta mora em lib/uploads/materiais porque a rota de dever faz o
    // mesmo caminho; antes, o loop estava duplicado nos dois arquivos.
    const materiais = await coletarMateriais(formData, auth.contaId, 'revisao');
    const conteudoCompleto = materiais.texto;
    const imagens = materiais.imagens;

    for (const aviso of materiais.avisos) console.warn('[POST /api/revisao]', aviso);

    if (!conteudoCompleto.trim() && imagens.length === 0) {
      return NextResponse.json({ error: 'Forneça texto ou arquivos.' }, { status: 400 });
    }

    const chave = req.headers.get('x-idempotency-key');

    const resultado = await comTransacao(async (client): Promise<ResultadoCriacao> => {
      // Fast path da idempotência: a mesma tentativa já foi criada (o usuário saiu
      // no meio da geração e o servidor commitou). Devolve a revisão existente sem
      // chamar a LLM nem debitar de novo.
      if (chave) {
        const existente = await getRevisaoPorChave(client, auth.contaId, chave);
        if (existente) {
          const { rows } = await client.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [auth.contaId]);
          return { status: 200, id: existente.id, saldo: rows[0].saldo_revisoes as number, duplicate: true };
        }
      }

      const saldo = await consumirSaldo(client, auth.contaId);
      if (saldo === null) return { status: 402 };
      // Saldo esgotado: consumirSaldo não escreveu nada, então o COMMIT do helper
      // não grava nada. Equivalente ao ROLLBACK que a rota faria nesse caminho.
      const questoes = await gerarQuestoes(conteudoCompleto, imagens);
      const id = await criarRevisao(client, auth.contaId, conteudoCompleto, null, chave);
      await createQuestoes(client, id, questoes, 1);
      await vincularMovimentoARevisao(client, auth.contaId, id);
      return { status: 200, id, saldo };
    });

    if (resultado.status === 402) {
      return NextResponse.json(
        { error: 'Você usou suas revisões. Resgate um token para continuar.' },
        { status: 402 },
      );
    }
    return NextResponse.json({
      id: resultado.id,
      saldo: resultado.saldo,
      ...(resultado.duplicate ? { duplicate: true } : {}),
    });
  } catch (err) {
    // Material inválido (id de outra conta, excesso): erro do cliente, devolve 400
    // com a razão em vez de 500. Antes de qualquer outra coisa: é a falha mais
    // comum e não deve cair no handler genérico.
    if (err instanceof MaterialInvalido) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    // Corrida: duas transações com a mesma chave. A segunda toma 23505 no INSERT
    // (índice único parcial) e seu débito é rollbackado. Reconsulta fora da
    // transação e devolve a revisão da primeira — um único débito no total.
    const chave = req.headers.get('x-idempotency-key');
    if ((err as { code?: string }).code === '23505' && chave) {
      const existente = await getRevisaoPorChave(getPool(), auth.contaId, chave);
      if (existente) {
        const { rows } = await getPool().query('SELECT saldo_revisoes FROM contas WHERE id = $1', [auth.contaId]);
        return NextResponse.json({ id: existente.id, saldo: rows[0].saldo_revisoes, duplicate: true });
      }
    }
    console.error('[POST /api/revisao] falha:', err);
    return NextResponse.json({ error: 'Não consegui falar com o professor. Tente novamente.' }, { status: 500 });
  }
}
