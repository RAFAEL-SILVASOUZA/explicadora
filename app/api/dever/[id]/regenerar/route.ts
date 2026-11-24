import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { CUSTO_DEVER, consumirSaldo } from '@/lib/quota';
import { getDever, getSlides, regenerarSlides, atualizarLeitura } from '@/lib/repos/deveres';
import { vincularMovimentoADever } from '@/lib/repos/movimentos';
import { comTransacao } from '@/lib/repos/transacao';
import { getPool } from '@/lib/db/pool';
import { gerarPlanoSeguro } from '@/lib/deveres/llm';
import { ImagemProcessada } from '@/lib/llm';
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

    // Regeneração precisa de texto: deveres criados só por foto não têm
    // conteúdo arquivado para a LLM reler.
    if (!dever.conteudo_texto.trim()) {
      return NextResponse.json(
        { error: 'Este dever foi criado a partir de fotos e não possui texto arquivado para regeneração.' },
        { status: 400 },
      );
    }

    // Re-gera o plano a partir do conteúdo salvo. Sem imagens (o dever não
    // guarda as imagens; só o texto).
    const { plano, vazamentoNaoCorrigido } = await gerarPlanoSeguro(dever.conteudo_texto, [] as ImagemProcessada[], nivel);

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
