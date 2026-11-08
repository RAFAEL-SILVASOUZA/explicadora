import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { consumirSaldo } from '@/lib/quota';
import { criarDever, criarPassos, getDeverPorChave } from '@/lib/repos/deveres';
import { vincularMovimentoADever } from '@/lib/repos/movimentos';
import { comTransacao } from '@/lib/repos/transacao';
import { getPool } from '@/lib/db/pool';
import { gerarStoryboardSeguro } from '@/lib/deveres/llm';
import { sintetizarPassos } from '@/lib/deveres/piper';
import { MaterialInvalido, coletarMateriais } from '@/lib/uploads/materiais';

type ResultadoCriacao =
  | { status: 402 }
  | { status: 200; id: string; saldo: number; duplicate?: boolean };

export async function POST(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  try {
    const formData = await req.formData();
    // Mesma coleta da rota de revisão: arquivos novos são guardados na biblioteca da
    // conta e ids de itens já guardados são relidos do servidor.
    const materiais = await coletarMateriais(formData, auth.contaId, 'dever');
    let conteudoCompleto = materiais.texto;
    const imagens = materiais.imagens;

    for (const aviso of materiais.avisos) console.warn('[POST /api/dever]', aviso);

    if (!conteudoCompleto.trim() && imagens.length === 0) {
      return NextResponse.json({ error: 'Envie uma foto do dever ou escreva o enunciado.' }, { status: 400 });
    }

    const chave = req.headers.get('x-idempotency-key');

    const resultado = await comTransacao(async (client): Promise<ResultadoCriacao> => {
      if (chave) {
        const existente = await getDeverPorChave(client, auth.contaId, chave);
        if (existente) {
          const { rows } = await client.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [auth.contaId]);
          return { status: 200, id: existente.id, saldo: rows[0].saldo_revisoes as number, duplicate: true };
        }
      }

      const saldo = await consumirSaldo(client, auth.contaId);
      if (saldo === null) return { status: 402 };

      const { storyboard } = await gerarStoryboardSeguro(conteudoCompleto, imagens);

      // O id do dever é reservado antes da síntese: os WAVs são gravados na pasta
      // dele. Se a transação falhar depois, sobram arquivos órfãos (removidos por
      // scripts/limpar-uploads-orfaos.ts), nunca um áudio apontando para outro dever.
      const id = await criarDever(client, auth.contaId, {
        titulo: storyboard.titulo || null,
        disciplina: storyboard.disciplina || null,
        conteudo_texto: conteudoCompleto,
        resumo_para_pais: storyboard.resumo_para_pais || null,
        chaveIdempotencia: chave,
      });

      const audios = await sintetizarPassos(id, storyboard.passos.map((p, i) => ({ ordem: i + 1, narracao: p.narracao })));
      const audioPorOrdem = new Map(audios.map((a) => [a.ordem, a]));

      await criarPassos(client, id, storyboard.passos.map((p, i) => {
        const audio = audioPorOrdem.get(i + 1);
        return {
          ordem: i + 1,
          titulo: p.titulo,
          narracao: p.narracao,
          cena: p.cena,
          audio_path: audio?.caminho || null,
          duracao_ms: audio?.duracao_ms ?? null,
        };
      }));

      await vincularMovimentoADever(client, auth.contaId, id);
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
    // Material inválido (id fora da conta, excesso de arquivos): erro do cliente, 400.
    if (err instanceof MaterialInvalido) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    // Corrida pela mesma chave: a segunda transação toma 23505 no índice único
    // parcial e o débito dela é rollbackado. Reconsulta e devolve o dever da
    // primeira: um único débito no total.
    const chave = req.headers.get('x-idempotency-key');
    if ((err as { code?: string }).code === '23505' && chave) {
      const existente = await getDeverPorChave(getPool(), auth.contaId, chave);
      if (existente) {
        const { rows } = await getPool().query('SELECT saldo_revisoes FROM contas WHERE id = $1', [auth.contaId]);
        return NextResponse.json({ id: existente.id, saldo: rows[0].saldo_revisoes, duplicate: true });
      }
    }
    console.error('[POST /api/dever] falha:', err);
    return NextResponse.json({ error: 'Não consegui falar com a explicadora. Tente novamente.' }, { status: 500 });
  }
}
