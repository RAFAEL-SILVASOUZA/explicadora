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

/**
 * Envia arquivos para a biblioteca. Aceita File ou Blob com nome explícito (File
 * já traz o nome; Blob não tem nome, então chamadores que fabricam um precisam
 * passá-lo).
 */
export async function enviarParaBiblioteca(
  arquivos: (File | Blob)[],
  nomes?: string[],
): Promise<{ ok: true; resultado: ResultadoUpload } | { ok: false; erro: string }> {
  const form = new FormData();
  arquivos.forEach((arquivo, i) => {
    const nome = arquivo instanceof File ? arquivo.name : (nomes?.[i] || `arquivo-${i + 1}`);
    form.append('arquivos', arquivo, nome);
  });
  const res = await apiFetch('/api/arquivos', { method: 'POST', body: form });
  const dados = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, erro: dados?.error || 'Não consegui enviar seus arquivos.' };
  return { ok: true, resultado: dados as ResultadoUpload };
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
 * cabeçalho Authorization e a rota é autenticada de propósito. Mesma solução do
 * áudio do dever (lib/client/audio.ts): baixar via apiFetch e abrir pela object URL.
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
