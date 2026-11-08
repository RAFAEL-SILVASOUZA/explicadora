'use client';

import { FileText, Image as ImageIcon, Trash2 } from 'lucide-react';
import { ArquivoPublico, abrirArquivo } from '@/lib/client/arquivos';
import { formatarTamanho } from '@/lib/client/format';

// Ícone por tipo, não miniatura do conteúdo: <img src> não envia cabeçalho
// Authorization e a rota de conteúdo é autenticada de propósito. Ver uma miniatura
// exigiria baixar cada arquivo para montar uma object URL; para o aluno saber o que
// é, o nome e o botão "Ver" bastam (decisão da v1).
export default function BibliotecaGrid({
  arquivos,
  aoRemover,
}: {
  arquivos: ArquivoPublico[];
  aoRemover: (arquivo: ArquivoPublico) => void;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-label="Seus arquivos">
      {arquivos.map((arquivo) => (
        <li key={arquivo.id} className="card !p-4 flex items-center gap-3">
          {arquivo.mime === 'application/pdf'
            ? <FileText size={28} className="shrink-0 text-primary" aria-hidden="true" />
            : <ImageIcon size={28} className="shrink-0 text-primary" aria-hidden="true" />}
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
            aria-label={`Remover ${arquivo.nome}`}
            onClick={() => aoRemover(arquivo)}
            className="shrink-0 p-3 rounded-lg text-red-600 hover:bg-red-50 focus-visible:outline-offset-2"
          >
            <Trash2 size={20} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
