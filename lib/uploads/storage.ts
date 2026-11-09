import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Object storage (Supabase Storage) no lugar do disco. No runtime serverless da
// Vercel o diretório do app (/var/task) é somente leitura e /tmp é efêmero, então
// gravar os bytes do upload no disco devolvia 500. Os bytes vão para um bucket
// PRIVADO; a leitura continua atrás das rotas autenticadas (a posse é validada no
// banco antes de pedir o objeto), como já era com uploads/ fora de public/.
//
// A chave do objeto é exatamente o valor gravado em arquivos.caminho
// ('uploads/biblioteca/<contaId>/<id>.<tipo>'), então o schema não muda e a
// leitura resolve direto pelo campo que já existe na linha.

let client: SupabaseClient | null = null;

function cliente(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    // A service role key ignora RLS e é secreta: só vive no servidor. Nunca expor
    // para o cliente (a variante NEXT_PUBLIC_ de uma service role jamais entra aqui).
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não estão definidos.');
    }
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

export function bucket(): string {
  return process.env.SUPABASE_BUCKET || 'uploads';
}

export async function storageUpload(
  objectKey: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await cliente().storage.from(bucket()).upload(objectKey, body, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`storage upload "${objectKey}": ${error.message}`);
}

export async function storageDownload(objectKey: string): Promise<Buffer> {
  const { data, error } = await cliente().storage.from(bucket()).download(objectKey);
  if (error || !data) {
    throw new Error(`storage download "${objectKey}": ${error?.message ?? 'resposta vazia'}`);
  }
  // No servidor, o download retorna um Blob global (Node >= 18). Arraybuffer
  // atravessa a fronteira sem copiar por ref.
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

export async function storageRemove(objectKeys: string[]): Promise<void> {
  if (objectKeys.length === 0) return;
  const { error } = await cliente().storage.from(bucket()).remove(objectKeys);
  if (error) throw new Error(`storage remove: ${error.message}`);
}
