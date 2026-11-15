import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getPool } from '@/lib/db/pool';
import { confirmarUploadDirecto } from '@/lib/uploads/direto';
import { paraArquivoPublico } from '@/lib/uploads/publico';

// Etapa 2 do envio direto (ver lib/uploads/direto.ts): o navegador terminou o PUT
// na URL assinada; esta rota mede, abre e registra o objeto que REALMENTE está no
// bucket. O body é minúsculo (três strings) — o pesado já ficou para trás.
//
// A posse não vem do cliente: a chave só é aceita se for a canônica da conta da
// sessão (id uuid dela + extensão do conjunto), então confirmar não consegue
// registrar objeto de outra conta nem caminho forjado.

export async function POST(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: 'Envie id, chave e nome em JSON.' }, { status: 400 });
  }
  if (typeof corpo !== 'object' || corpo === null) {
    return NextResponse.json({ error: 'Envie id, chave e nome em JSON.' }, { status: 400 });
  }
  const { id, chave, nome } = corpo as { id?: unknown; chave?: unknown; nome?: unknown };
  if (
    typeof id !== 'string' || id.length > 100 ||
    typeof chave !== 'string' || chave.length > 1000 ||
    typeof nome !== 'string' || nome.length > 1000
  ) {
    return NextResponse.json({ error: 'Envie id, chave e nome do arquivo.' }, { status: 400 });
  }

  const resultado = await confirmarUploadDirecto(getPool(), {
    contaId: auth.contaId,
    id,
    chave,
    nomeOriginal: nome,
  });
  // 200 também na recusa, pelo mesmo motivo do preparar: desfecho por arquivo, não
  // erro da requisição. Sucesso real nasce linha nova: 201, como no POST antigo.
  if (!resultado.ok) {
    return NextResponse.json({ situacao: 'recusado', motivo: resultado.recusa.motivo });
  }
  return NextResponse.json(
    {
      situacao: resultado.duplicado ? 'duplicado' : 'criado',
      arquivo: paraArquivoPublico(resultado.arquivo),
    },
    { status: resultado.duplicado ? 200 : 201 },
  );
}
