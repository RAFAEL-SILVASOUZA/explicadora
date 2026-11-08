'use client';

import { useEffect, useState } from 'react';
import { FileText, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { ArquivoPublico, listarArquivosDaConta } from '@/lib/client/arquivos';

// Só imagem pesa no teto de contexto de visão da LLM: PDF entra como texto. O
// formulário precisa desse número para somar aos arquivos novos que ele aceita.
export function saoImagens(arquivos: ArquivoPublico[], ids: string[]): number {
  return arquivos.filter((a) => ids.includes(a.id) && a.mime !== 'application/pdf').length;
}

/**
 * A lista da biblioteca dentro dos formulários de revisão e dever. O aluno marca o
 * que quer usar e o formulário envia os ids (campo `arquivoIds`); o servidor relê os
 * bytes do disco. Nenhum arquivo é reenviado pelo navegador.
 *
 * Lista carregada ao montar: a biblioteca muda entre visitas, não durante o
 * preenchimento do formulário, e um botão recarregar cobre quem acabou de enviar
 * arquivos em outra aba.
 *
 * `aoMudar` devolve também a contagem de imagens marcadas: sem ela o formulário não
 * consegue aplicar MAX_IMAGENS ao total (biblioteca + arquivos novos).
 */
export default function SelecionarDaBiblioteca({
  selecionados,
  aoMudar,
}: {
  selecionados: string[];
  aoMudar: (ids: string[], imagensSelecionadas: number) => void;
}) {
  const [arquivos, setArquivos] = useState<ArquivoPublico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [vazio, setVazio] = useState(false);

  const carregar = () => {
    setCarregando(true);
    listarArquivosDaConta()
      .then((lista) => {
        setArquivos(lista);
        setVazio(lista.length === 0);
      })
      .catch(() => setVazio(true))
      .finally(() => setCarregando(false));
  };

  useEffect(() => { carregar(); }, []);

  const alternar = (id: string) => {
    const proximos = selecionados.includes(id)
      ? selecionados.filter((x) => x !== id)
      : [...selecionados, id];
    aoMudar(proximos, saoImagens(arquivos, proximos));
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-ink/15 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <label className="block text-xl font-semibold text-ink">Usar arquivos da minha biblioteca</label>
        <button type="button" onClick={carregar} className="btn-secondary !py-2 !px-3 text-base">
          <RefreshCw size={18} aria-hidden="true" /> Atualizar lista
        </button>
      </div>

      {carregando ? (
        <p className="text-ink/70">Carregando seus arquivos...</p>
      ) : vazio || arquivos.length === 0 ? (
        <p className="text-ink/70">
          Você ainda não tem arquivos guardados. Envie aqui embaixo ou use{' '}
          <a href="/arquivos" className="font-semibold text-primary-dark underline">Meus arquivos</a>.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Arquivos da sua biblioteca">
          {arquivos.map((arquivo) => (
            <li key={arquivo.id}>
              <label className="flex items-center gap-3 rounded-xl bg-ink/5 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  name={`biblioteca-${arquivo.id}`}
                  checked={selecionados.includes(arquivo.id)}
                  onChange={() => alternar(arquivo.id)}
                  className="w-5 h-5 accent-primary"
                />
                {arquivo.mime === 'application/pdf'
                  ? <FileText size={22} className="shrink-0 text-primary" aria-hidden="true" />
                  : <ImageIcon size={22} className="shrink-0 text-primary" aria-hidden="true" />}
                <span className="min-w-0 flex-1 text-ink break-all">{arquivo.nome}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
