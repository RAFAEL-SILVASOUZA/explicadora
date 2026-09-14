import { NextRequest, NextResponse } from 'next/server';
import { createSessao, createQuestoes } from '@/lib/db';
import { gerarQuestoes, ImagemProcessada } from '@/lib/llm';
import { extrairTextoPDF } from '@/lib/pdf';
import { processarImagem } from '@/lib/imagem';
import { MAX_IMAGENS } from '@/lib/constantes';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
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
        try {
          const pdfTexto = await extrairTextoPDF(buffer);
          conteudoCompleto += `\n\n--- Conteúdo do PDF: ${file.name} ---\n${pdfTexto}`;
        } catch {
          // PDF ilegível, continua
        }
      } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) {
        if (imagens.length >= MAX_IMAGENS) {
          continue;
        }
        try {
          const { base64, mime } = await processarImagem(buffer);
          imagens.push({ base64, mime });
          const uploadPath = path.join(process.cwd(), 'uploads', file.name);
          fs.writeFileSync(uploadPath, buffer);
        } catch {
          // Imagem ilegível, continua
        }
      }
    }

    if (!conteudoCompleto.trim() && imagens.length === 0) {
      return NextResponse.json({ error: 'Forneça texto ou arquivos.' }, { status: 400 });
    }

    const questoes = await gerarQuestoes(conteudoCompleto, imagens);
    const id = createSessao(conteudoCompleto);
    createQuestoes(id, questoes);

    return NextResponse.json({ id });
  } catch (err: any) {
    console.error('[POST /api/revisao] falha:', err);
    return NextResponse.json({ error: 'Não consegui falar com o professor. Tente novamente.' }, { status: 500 });
  }
}
