import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { CUSTO_DEVER, consumirSaldo } from '@/lib/quota';
import { getDever, regenerarSlides, atualizarLeitura } from '@/lib/repos/deveres';
import { vincularMovimentoADever } from '@/lib/repos/movimentos';
import { comTransacao } from '@/lib/repos/transacao';
import { getPool } from '@/lib/db/pool';
import { gerarPlanoSeguro } from '@/lib/deveres/llm';
import { hashConteudo, setCache } from '@/lib/deveres/cache';
import { recarregarMateriais } from '@/lib/uploads/materiais';
import { NivelAluno } from '@/lib/types';

// Regenera o plano de um dever existente: substitui os slides e debita meia
// revisão. O dever original é preservado (o conteúdo não é apagado); só os
// slides são substituídos.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  try {
    const dever = await getDever(params.id, auth.contaId);
    if (!dever) return NextResponse.json({ error: 'Dever não encontrado.' }, { status: 404 });

    const nivel: NivelAluno = dever.nivel === 'adolescente' || dever.nivel === 'adulto' ? dever.nivel : 'crianca';

    // Relê as fotos originais. Sem isto a regeneração só teria o texto digitado, e
    // um dever criado a partir de foto não teria nada para a LLM reler.
    const materiais = await recarregarMateriais(auth.contaId, dever.arquivo_ids);
    for (const aviso of materiais.avisos) console.warn('[POST /api/dever/[id]/regenerar]', aviso);

    if (!dever.conteudo_texto.trim() && materiais.imagens.length === 0) {
      return NextResponse.json(
        { error: 'Este dever não tem material arquivado para regeneração.' },
        { status: 400 },
      );
    }

    // A mesma chave da criação: é ela que faz o plano novo substituir o antigo em
    // cache, em vez de deixar o aluno receber a explicação velha ao reenviar o
    // mesmo conteúdo.
    const hash = hashConteudo(dever.conteudo_texto, materiais.hashes, nivel);

    const { plano, vazamentoNaoCorrigido } = await gerarPlanoSeguro(
      dever.conteudo_texto, materiais.imagens, nivel,
    );

    if (!plano.slides || plano.slides.length === 0) {
      return NextResponse.json({ error: 'A explicadora não devolveu nenhum slide. Tente novamente.' }, { status: 500 });
    }

    const resultado = await comTransacao(async (client) => {
      const consumo = await consumirSaldo(client, auth.contaId, CUSTO_DEVER);
      if (consumo === null) return { status: 402 as const };

      await regenerarSlides(client, params.id, plano.slides.map((s, i) => ({
        ordem: i + 1,
        titulo: s.titulo,
        explicacao: s.explicacao,
      })));

      // Resetar a leitura: a nova explicação começa do zero.
      await atualizarLeitura(client, params.id, 0, false);

      await vincularMovimentoADever(client, auth.contaId, params.id, consumo.movimentoId);
      return { status: 200 as const, saldo: consumo.saldo, vazamentoNaoCorrigido };
    });

    if (resultado.status === 402) {
      return NextResponse.json(
        { error: 'Você usou suas revisões. Resgate um token para continuar.' },
        { status: 402 },
      );
    }

    // Depois do commit: um plano que não chegou ao aluno não entra no cache. E um
    // plano neutralizado também não, pelo mesmo motivo da criação: serviria o slide
    // quebrado para sempre, sem dar à LLM uma nova chance.
    if (!resultado.vazamentoNaoCorrigido) {
      await setCache(getPool(), auth.contaId, hash, nivel, plano);
    }
    return NextResponse.json({
      ok: true,
      saldo: resultado.saldo,
      ...(resultado.vazamentoNaoCorrigido ? { vazamentoNaoCorrigido: true } : {}),
    });
  } catch (err) {
    console.error('[POST /api/dever/[id]/regenerar] falha:', err);
    return NextResponse.json({ error: 'Não consegui falar com a explicadora. Tente novamente.' }, { status: 500 });
  }
}
