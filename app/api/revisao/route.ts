import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { consumirSaldo } from '@/lib/quota';
import { criarRevisao, createQuestoes } from '@/lib/repos/revisoes';
import { vincularMovimentoARevisao } from '@/lib/repos/movimentos';
import { comTransacao } from '@/lib/repos/transacao';
import { gerarQuestoes, ImagemProcessada } from '@/lib/llm';
import { extrairTextoPDF } from '@/lib/pdf';
import { processarImagem } from '@/lib/imagem';
import { MAX_IMAGENS } from '@/lib/constantes';
import path from 'path';
import fs from 'fs';

// O resultado da transação: 402 quando o saldo está esgotado, 200 quando a
// revisão foi criada. A rota não decide o SQL, só o código HTTP.
type ResultadoCriacao = { status: 402 } | { status: 200; id: string; saldo: number };

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

    const resultado = await comTransacao(async (client): Promise<ResultadoCriacao> => {
      const saldo = await consumirSaldo(client, auth.contaId);
      if (saldo === null) return { status: 402 };
      // Saldo esgotado: consumirSaldo não escreveu nada, então o COMMIT do helper
      // não grava nada. Equivalente ao ROLLBACK que a rota faria nesse caminho.
      const questoes = await gerarQuestoes(conteudoCompleto, imagens);
      const id = await criarRevisao(client, auth.contaId, conteudoCompleto, null);
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
    return NextResponse.json({ id: resultado.id, saldo: resultado.saldo });
  } catch (err) {
    console.error('[POST /api/revisao] falha:', err);
    return NextResponse.json({ error: 'Não consegui falar com o professor. Tente novamente.' }, { status: 500 });
  }
}
