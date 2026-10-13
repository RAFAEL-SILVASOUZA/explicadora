import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { consumirSaldo } from '@/lib/quota';
import { criarRevisao, createQuestoes, getRevisaoPorChave } from '@/lib/repos/revisoes';
import { vincularMovimentoARevisao } from '@/lib/repos/movimentos';
import { comTransacao } from '@/lib/repos/transacao';
import { getPool } from '@/lib/db/pool';
import { gerarQuestoes, ImagemProcessada } from '@/lib/llm';
import { extrairTextoPDF } from '@/lib/pdf';
import { processarImagem } from '@/lib/imagem';
import { MAX_IMAGENS } from '@/lib/constantes';
import path from 'path';
import fs from 'fs';

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
    const texto = (formData.get('texto') as string) || '';
    const files = formData.getAll('arquivos') as File[];

    let conteudoCompleto = texto;
    const imagens: ImagemProcessada[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') {
        try { conteudoCompleto += `\n\n--- Conteúdo do PDF: ${file.name} ---\n${await extrairTextoPDF(buffer)}`; } catch {}
      } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) {
        if (imagens.length >= MAX_IMAGENS) continue;
        try {
          const { base64, mime } = await processarImagem(buffer);
          imagens.push({ base64, mime });
          fs.writeFileSync(path.join(process.cwd(), 'uploads', file.name), buffer);
        } catch {}
      }
    }

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
