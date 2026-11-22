'use client';

import { useState } from 'react';
import { FileText, Image as ImageIcon, Pencil, Trash2 } from 'lucide-react';
import { ArquivoPublico, abrirArquivo } from '@/lib/client/arquivos';
import { dividirNomeExibicao, ehRaizNomeValida } from '@/lib/uploads/nomeSeguro';
import { MAX_CARACTERES_NOME_ARQUIVO } from '@/lib/constantes';
import { formatarTamanho } from '@/lib/client/format';
import Spinner from '@/components/Spinner';

// O rascunho do renomeio descarta o que a regra proíbe conforme se digita
// (espaço, ponto, acento) e corta nos 25 caracteres: o input nunca deixa entrar
// estado inválido. A validação da API continua sendo a fonte de verdade — o
// cliente só evita o 400 óbvio. Um nome antigo com radical pontuado ('a.b.pdf',
// possível no upload) abre já limpo ('ab'), e o aluno vê o resultado no input.
function rascunhoValido(valor: string): string {
  return valor.replace(/[^A-Za-z0-9_-]/g, '').slice(0, MAX_CARACTERES_NOME_ARQUIVO);
}

// Ícone por tipo, não miniatura do conteúdo: <img src> não envia cabeçalho
// Authorization e a rota de conteúdo é autenticada de propósito. Ver uma miniatura
// exigiria baixar cada arquivo para montar uma object URL; para o aluno saber o que
// é, o nome e o botão "Ver" bastam (decisão da v1).
export default function BibliotecaGrid({
  arquivos,
  aoRemover,
  aoRenomear,
}: {
  arquivos: ArquivoPublico[];
  aoRemover: (arquivo: ArquivoPublico) => void | Promise<void>;
  aoRenomear: (arquivo: ArquivoPublico, novaRaiz: string) => Promise<void>;
}) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');
  // Cada ação de rede trava o próprio card: sem isso o "Ver" de 10 MB, o salvar do
  // renomeio e a lixeira ficam mutáveis durante a espera — e o clique duplo vira bug.
  const [abrindoId, setAbrindoId] = useState<string | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [erroAbrir, setErroAbrir] = useState('');

  const abrirEdicao = (arquivo: ArquivoPublico) => {
    setRascunho(rascunhoValido(dividirNomeExibicao(arquivo.nome).raiz));
    setEditandoId(arquivo.id);
  };

  const ver = async (arquivo: ArquivoPublico) => {
    if (abrindoId) return;
    setAbrindoId(arquivo.id);
    setErroAbrir('');
    const ok = await abrirArquivo(arquivo.id);
    setAbrindoId(null);
    if (!ok) setErroAbrir(`Não consegui abrir "${arquivo.nome}". Tente de novo.`);
  };

  const salvar = async (arquivo: ArquivoPublico) => {
    if (!ehRaizNomeValida(rascunho) || salvandoId) return;
    setSalvandoId(arquivo.id);
    await aoRenomear(arquivo, rascunho);
    setSalvandoId(null);
    setEditandoId(null);
  };

  const remover = async (arquivo: ArquivoPublico) => {
    if (removendoId) return;
    setRemovendoId(arquivo.id);
    await Promise.resolve(aoRemover(arquivo));
    setRemovendoId(null);
  };

  return (
    <>
    {erroAbrir && (
      <div role="alert" className="mb-3 bg-danger-light border-2 border-danger/40 rounded-2xl p-4 text-danger-ink font-semibold">
        {erroAbrir}
      </div>
    )}
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-label="Seus arquivos">
      {arquivos.map((arquivo) => {
        const { extensao } = dividirNomeExibicao(arquivo.nome);
        const editando = editandoId === arquivo.id;
        return (
          <li key={arquivo.id} className="card !p-4 flex items-center gap-3">
            {arquivo.mime === 'application/pdf'
              ? <FileText size={28} className="shrink-0 text-primary" aria-hidden="true" />
              : <ImageIcon size={28} className="shrink-0 text-primary" aria-hidden="true" />}
            {editando ? (
              <form
                className="min-w-0 flex-1 flex items-center gap-2"
                onSubmit={(e) => { e.preventDefault(); void salvar(arquivo); }}
              >
                <label htmlFor={`renomear-${arquivo.id}`} className="sr-only">
                  Novo nome de {arquivo.nome} (sem espaços, até {MAX_CARACTERES_NOME_ARQUIVO} caracteres)
                </label>
                <input
                  id={`renomear-${arquivo.id}`}
                  value={rascunho}
                  maxLength={MAX_CARACTERES_NOME_ARQUIVO}
                  autoFocus
                  disabled={salvandoId === arquivo.id}
                  onChange={(e) => setRascunho(rascunhoValido(e.target.value))}
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditandoId(null); }}
                  className="min-w-0 flex-1 rounded-lg border-2 border-ink/20 px-2 py-1 text-ink font-semibold focus-visible:outline-2 focus-visible:outline-primary"
                />
                {extensao && (
                  <span className="shrink-0 text-sm text-ink/60" aria-hidden="true">.{extensao}</span>
                )}
                <button
                  type="submit"
                  disabled={salvandoId === arquivo.id}
                  aria-busy={salvandoId === arquivo.id}
                  className="btn-secondary !py-2 !px-3 text-base shrink-0"
                >
                  {salvandoId === arquivo.id && <Spinner tamanho="sm" label="Salvando novo nome…" />}
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setEditandoId(null)}
                  disabled={salvandoId === arquivo.id}
                  className="text-ink/60 underline text-base shrink-0 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </form>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-ink font-semibold break-all">{arquivo.nome}</p>
                  <p className="text-sm text-ink/60">
                    {formatarTamanho(arquivo.tamanho)} · {new Date(arquivo.criado_em).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                {/* O download pode pesar 10 MB: o botão gira e se tranca enquanto não abre. */}
                <button
                  type="button"
                  onClick={() => void ver(arquivo)}
                  disabled={abrindoId !== null}
                  aria-busy={abrindoId === arquivo.id}
                  className="btn-secondary !py-2 !px-3 text-base shrink-0"
                >
                  {abrindoId === arquivo.id && <Spinner tamanho="sm" label={`Abrindo ${arquivo.nome}…`} />}
                  Ver
                </button>
                <button
                  type="button"
                  aria-label={`Renomear ${arquivo.nome}`}
                  onClick={() => abrirEdicao(arquivo)}
                  className="shrink-0 p-3 rounded-lg text-ink/60 hover:bg-ink/5 focus-visible:outline-offset-2"
                >
                  <Pencil size={20} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Remover ${arquivo.nome}`}
                  onClick={() => void remover(arquivo)}
                  disabled={removendoId !== null}
                  aria-busy={removendoId === arquivo.id}
                  className="shrink-0 p-3 rounded-lg text-red-600 hover:bg-red-50 focus-visible:outline-offset-2 disabled:opacity-50"
                >
                  {removendoId === arquivo.id
                    ? <Spinner tamanho="sm" corDoAnel="border-red-600" label={`Removendo ${arquivo.nome}…`} />
                    : <Trash2 size={20} aria-hidden="true" />}
                </button>
              </>
            )}
          </li>
        );
      })}
    </ul>
    </>
  );
}
