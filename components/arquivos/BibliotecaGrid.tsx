'use client';

import { useState } from 'react';
import { FileText, Image as ImageIcon, Pencil, Trash2 } from 'lucide-react';
import { ArquivoPublico, abrirArquivo } from '@/lib/client/arquivos';
import { dividirNomeExibicao, ehRaizNomeValida } from '@/lib/uploads/nomeSeguro';
import { MAX_CARACTERES_NOME_ARQUIVO } from '@/lib/constantes';
import { formatarTamanho } from '@/lib/client/format';

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
  aoRemover: (arquivo: ArquivoPublico) => void;
  aoRenomear: (arquivo: ArquivoPublico, novaRaiz: string) => Promise<void>;
}) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');

  const abrirEdicao = (arquivo: ArquivoPublico) => {
    setRascunho(rascunhoValido(dividirNomeExibicao(arquivo.nome).raiz));
    setEditandoId(arquivo.id);
  };

  const salvar = async (arquivo: ArquivoPublico) => {
    if (!ehRaizNomeValida(rascunho)) return;
    setEditandoId(null);
    await aoRenomear(arquivo, rascunho);
  };

  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-label="Seus arquivos">
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
                  onChange={(e) => setRascunho(rascunhoValido(e.target.value))}
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditandoId(null); }}
                  className="min-w-0 flex-1 rounded-lg border-2 border-ink/20 px-2 py-1 text-ink font-semibold focus-visible:outline-2 focus-visible:outline-primary"
                />
                {extensao && (
                  <span className="shrink-0 text-sm text-ink/60" aria-hidden="true">.{extensao}</span>
                )}
                <button type="submit" className="btn-secondary !py-2 !px-3 text-base shrink-0">Salvar</button>
                <button
                  type="button"
                  onClick={() => setEditandoId(null)}
                  className="text-ink/60 underline text-base shrink-0"
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
                <button
                  type="button"
                  onClick={() => abrirArquivo(arquivo.id)}
                  className="btn-secondary !py-2 !px-3 text-base shrink-0"
                >
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
                  onClick={() => aoRemover(arquivo)}
                  className="shrink-0 p-3 rounded-lg text-red-600 hover:bg-red-50 focus-visible:outline-offset-2"
                >
                  <Trash2 size={20} aria-hidden="true" />
                </button>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
