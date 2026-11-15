import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { prepararUploadDirecto } from '@/lib/uploads/direto';

// Etapa 1 do envio direto (ver lib/uploads/direto.ts): o cliente declara o arquivo,
// manda só a AMOSTRA dos primeiros 64 KiB, e recebe a URL assinada para subir os
// bytes ao bucket ele mesmo. Os bytes não passam por aqui — por isso o corpo cabe
// nos 4.5 MB do Vercel por folga de duas ordens de grandeza.
//
// A resposta nunca expõe o bucket nem exige segredo: a URL assinada já carrega o
// token de upload (validade padrão do Supabase: 2 horas).

const AMOSTRA_MAX_CARACTERES = 96_000; // ~70 KiB de bytes; a fatia real é de 64 KiB.

export async function POST(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: 'Envie os dados do arquivo em JSON.' }, { status: 400 });
  }
  if (typeof corpo !== 'object' || corpo === null) {
    return NextResponse.json({ error: 'Envie os dados do arquivo em JSON.' }, { status: 400 });
  }
  const { nome, tamanho, amostra } = corpo as {
    nome?: unknown; tamanho?: unknown; amostra?: unknown;
  };
  if (
    typeof nome !== 'string' || nome.length > 1000 ||
    typeof tamanho !== 'number' ||
    typeof amostra !== 'string' || amostra.length > AMOSTRA_MAX_CARACTERES
  ) {
    return NextResponse.json({ error: 'Envie nome, tamanho e amostra do arquivo.' }, { status: 400 });
  }

  // 200 em todo desfecho legítimo (aceito ou recusa motivada): a tela envia vários
  // arquivos em sequência e agrega os resultados — recusa de UM arquivo não é erro
  // da requisição.
  const resultado = await prepararUploadDirecto({
    contaId: auth.contaId,
    nomeOriginal: nome,
    tamanho,
    amostra: Buffer.from(amostra, 'base64'),
  });
  if (!resultado.ok) {
    return NextResponse.json({ situacao: 'recusado', motivo: resultado.recusa.motivo });
  }
  return NextResponse.json({
    situacao: 'novo',
    id: resultado.id,
    chave: resultado.chave,
    uploadUrl: resultado.uploadUrl,
  });
}
