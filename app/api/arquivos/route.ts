import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getPool } from '@/lib/db/pool';
import { listarArquivos } from '@/lib/repos/arquivos';
import { arquivarBuffer } from '@/lib/uploads/biblioteca';
import { MAX_ARQUIVOS_POR_ENVIO } from '@/lib/constantes';
import { ArquivoPublico, paraArquivoPublico } from '@/lib/uploads/publico';

// A biblioteca do aluno: POST grava em lote, GET lista. A remoção e a leitura dos
// bytes têm rotas próprias ([id] e [id]/conteudo).
// Os bytes ficam fora de public/ de propósito (mesma razão do áudio do dever):
// public/ é servido sem autenticação e o material de uma criança não pode ser lido
// por quem descobrir a URL.

export async function GET(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  const arquivos = await listarArquivos(auth.contaId);
  return NextResponse.json(arquivos.map(paraArquivoPublico));
}

export async function POST(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Envie os arquivos como formulário.' }, { status: 400 });
  }

  const files = formData.getAll('arquivos') as File[];
  if (files.length === 0) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
  }
  if (files.length > MAX_ARQUIVOS_POR_ENVIO) {
    return NextResponse.json(
      { error: `Envie no máximo ${MAX_ARQUIVOS_POR_ENVIO} arquivos por vez.` },
      { status: 400 },
    );
  }

  const pool = getPool();
  const criados: ArquivoPublico[] = [];
  const duplicados: ArquivoPublico[] = [];
  const recusados: { nome: string; motivo: string }[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const resultado = await arquivarBuffer(pool, {
      contaId: auth.contaId,
      nomeOriginal: file.name,
      buffer,
      origem: 'biblioteca',
    });
    if (!resultado.ok) {
      recusados.push({ nome: file.name, motivo: resultado.recusa.motivo });
      continue;
    }
    const publico = paraArquivoPublico(resultado.arquivo);
    if (resultado.duplicado) duplicados.push(publico);
    else criados.push(publico);
  }

  // Nada aceito e algo recusado: o erro diz por quê. Envio com tudo recusado não é
  // sucesso silencioso.
  if (criados.length === 0 && duplicados.length === 0 && recusados.length > 0) {
    return NextResponse.json(
      { error: 'Nenhum arquivo foi aceito. Use PNG, JPG, WEBP ou PDF de até 10 MB.', recusados },
      { status: 400 },
    );
  }

  return NextResponse.json({ criados, duplicados, recusados }, { status: 201 });
}
