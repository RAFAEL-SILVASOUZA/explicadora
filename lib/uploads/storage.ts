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

// URL assinada de UPLOAD: o navegador envia os bytes direto para o bucket com um
// PUT nela, sem a chave service role e sem apikey — o token na query autoriza
// sozinho (comportamento documentado do createSignedUploadUrl). Existe porque o
// Vercel corta corpo de requisição em 4.5 MB (FUNCTION_PAYLOAD_TOO_LARGE, antes do
// Next rodar): fotos de celular passam disso fácil, e o envio passaria a 413 se os
// bytes entrassem pela rota. O upsert entra aqui (e não em header do cliente)
// porque o token já nasce com a flag.
export async function storageAssinarUpload(objectKey: string): Promise<string> {
  const { data, error } = await cliente().storage
    .from(bucket())
    .createSignedUploadUrl(objectKey, { upsert: true });
  if (error || !data) {
    throw new Error(`storage signed upload "${objectKey}": ${error?.message ?? 'resposta vazia'}`);
  }
  return data.signedUrl;
}

// Tamanho real do objeto no bucket, sem baixar nada. O confirmar usa antes do
// download: um cliente que ignorou o limite e mandou 100 MB pela URL assinada é
// medido e apagado antes de entrar na memória da função. null = objeto não existe.
export async function storageTamanhoDaChave(objectKey: string): Promise<number | null> {
  const { data, error } = await cliente().storage.from(bucket()).info(objectKey);
  if (error || !data) return null;
  // Verificado no projeto real (2026-11-15): nesta versão do storage-js o info()
  // devolve o tamanho em data.size (camelizado no topo); metadata chega {}. O
  // fallback em metadata.size cobre versões que devolveram o tamanho por lá.
  const info = data as { size?: number; metadata?: { size?: number } };
  const tamanho = typeof info.size === 'number' ? info.size : info.metadata?.size;
  return typeof tamanho === 'number' ? tamanho : null;
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
