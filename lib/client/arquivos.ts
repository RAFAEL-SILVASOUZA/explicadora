import { apiFetch } from './api';
// O shape vem de lib/uploads/publico.ts, único lugar onde a API descreve o que
// devolve: duas definições do mesmo shape divergiriam (um campo novo apareceria no
// servidor e sumiria silenciosamente da tela).
import { ArquivoPublico } from '../uploads/publico';

export type { ArquivoPublico };

// Espelha a regra do servidor (MAX_BYTES_POR_ARQUIVO). Importar de lib/constantes é
// possível (o arquivo não tem dependência de servidor), mas o cliente precisa da
// mensagem em texto, então o número vem da constante e a frase fica aqui.
export const LIMITE_BYTES_POR_ARQUIVO = 10 * 1024 * 1024;

export async function listarArquivosDaConta(): Promise<ArquivoPublico[]> {
  const res = await apiFetch('/api/arquivos');
  if (!res.ok) return [];
  return (await res.json()) as ArquivoPublico[];
}

export interface ResultadoUpload {
  criados: ArquivoPublico[];
  duplicados: ArquivoPublico[];
  recusados: { nome: string; motivo: string }[];
}

// Blob.arrayBuffer() existe em todo navegador-alvo, mas não no jsdom (que roda os
// testes de componente): FileReader cobre os dois mundos com o mesmo resultado.
function lerArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as ArrayBuffer);
    leitor.onerror = () => reject(leitor.error ?? new Error('falha ao ler o arquivo'));
    leitor.readAsArrayBuffer(blob);
  });
}

// Primeiros 64 KiB, em base64, para o servidor decidir o tipo (e recusar lixo)
// ANTES de o celular gastar dados subindo um arquivo que seria recusado no fim.
async function amostraBase64(arquivo: Blob): Promise<string> {
  const pedaco = new Uint8Array(await lerArrayBuffer(arquivo.slice(0, 64 * 1024)));
  // String.fromCharCode com espalhamento estoura a pilha em blocos grandes; por
  // isso o laço de 32 KiB em vez de uma chamada só.
  let texto = '';
  for (let i = 0; i < pedaco.length; i += 0x8000) {
    texto += String.fromCharCode(...pedaco.subarray(i, i + 0x8000));
  }
  return btoa(texto);
}

/**
 * Envia arquivos para a biblioteca em três passos POR ARQUIVO (ver
 * lib/uploads/direto.ts): preparar (rota nossa) → PUT dos bytes (bucket, via URL
 * assinada) → confirmar (rota nossa). Os bytes nunca atravessam a rota porque o
 * Vercel corta corpo de requisição em 4.5 MB — e foto de celular passa disso fácil.
 * Em sequência, um arquivo por vez: é a rede do aluno, não um estúdio de fibra.
 *
 * Aceita File ou Blob com nome explícito (File já traz o nome; Blob não tem nome,
 * então chamadores que fabricam um precisam passá-lo).
 */
export async function enviarParaBiblioteca(
  arquivos: (File | Blob)[],
  nomes?: string[],
  // Avisamos o chamador a cada arquivo que começa (1-indexado): 5 fotos no 4G são
  // um silêncio longo, e "enviando 2 de 5" transforma silêncio em espera visível.
  progresso?: (atual: number, total: number) => void,
): Promise<{ ok: true; resultado: ResultadoUpload } | { ok: false; erro: string }> {
  const resultado: ResultadoUpload = { criados: [], duplicados: [], recusados: [] };
  const json = (corpo: unknown) => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  });

  for (const [i, arquivo] of arquivos.entries()) {
    progresso?.(i + 1, arquivos.length);
    const nome = arquivo instanceof File ? arquivo.name : (nomes?.[i] || `arquivo-${i + 1}`);
    const recusa = (motivo: string) => resultado.recusados.push({ nome, motivo });
    try {
      const preparado = await (await apiFetch('/api/arquivos/preparar', json({
        nome,
        tamanho: arquivo.size,
        amostra: await amostraBase64(arquivo),
      }))).json();
      if (preparado?.situacao === 'recusado') { recusa(preparado.motivo); continue; }
      if (preparado?.situacao !== 'novo') { recusa('rede'); continue; }

      // PUT sem apiFetch: a URL assinada carrega o token de upload na query, e o
      // bucket não conhece (nem precisa conhecer) o nosso token de sessão.
      const subiu = await fetch(preparado.uploadUrl, { method: 'PUT', body: arquivo });
      if (!subiu.ok) { recusa('rede'); continue; }

      const confirmado = await (await apiFetch('/api/arquivos/confirmar', json({
        id: preparado.id,
        chave: preparado.chave,
        nome,
      }))).json();
      if (confirmado?.situacao === 'criado') resultado.criados.push(confirmado.arquivo);
      else if (confirmado?.situacao === 'duplicado') resultado.duplicados.push(confirmado.arquivo);
      else recusa(confirmado?.motivo || 'rede');
    } catch {
      // Rede caiu no meio do arquivo: o próximo começa do zero, este não.
      recusa('rede');
    }
  }

  // Se NADA passou e o motivo de tudo foi rede, a falha é do envio, não dos
  // arquivos — a frase genérica antiga, agora com o empurrão certo.
  const tudoRede = resultado.recusados.length > 0
    && resultado.recusados.every((r) => r.motivo === 'rede');
  if (resultado.criados.length === 0 && resultado.duplicados.length === 0 && tudoRede) {
    return { ok: false, erro: 'Não consegui enviar seus arquivos. Verifique sua conexão e tente de novo.' };
  }
  return { ok: true, resultado };
}

export async function removerDaBiblioteca(id: string): Promise<boolean> {
  const res = await apiFetch(`/api/arquivos/${id}`, { method: 'DELETE' });
  return res.ok;
}

/**
 * Renomeia um arquivo da biblioteca. Manda só o radical ('prova-logica'): a
 * extensão é recomposta pelo servidor a partir da linha atual, então um cliente
 * adulterado não consegue trocar a extensão de um PNG para '.pdf'.
 */
export async function renomearNaBiblioteca(
  id: string, raiz: string,
): Promise<{ ok: true; arquivo: ArquivoPublico } | { ok: false; erro: string }> {
  const res = await apiFetch(`/api/arquivos/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nome: raiz }),
  });
  const dados = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, erro: dados?.error || 'Não consegui renomear o arquivo.' };
  return { ok: true, arquivo: dados as ArquivoPublico };
}

/**
 * Abre o arquivo em nova aba. <a href> não serve: o elemento âncora não envia
 * cabeçalho Authorization e a rota é autenticada de propósito. A solução é a
 * mesma do download autenticado: baixar via apiFetch e abrir pela object URL.
 */
export async function abrirArquivo(id: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/arquivos/${id}/conteudo`);
    if (!res.ok) return false;
    const url = URL.createObjectURL(await res.blob());
    window.open(url, '_blank', 'noopener');
    return true;
  } catch {
    return false;
  }
}
