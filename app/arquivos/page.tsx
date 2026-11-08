'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Library, Plus, Upload } from 'lucide-react';
import Header from '@/components/Header';
import Mascote from '@/components/Mascote';
import BibliotecaGrid from '@/components/arquivos/BibliotecaGrid';
import {
  ArquivoPublico,
  LIMITE_BYTES_POR_ARQUIVO,
  enviarParaBiblioteca,
  listarArquivosDaConta,
  removerDaBiblioteca,
} from '@/lib/client/arquivos';
import { lerToken } from '@/lib/client/api';
import { MAX_ARQUIVOS_POR_ENVIO } from '@/lib/constantes';

export default function Arquivos() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<ArquivoPublico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!lerToken()) {
      router.replace('/login');
      return;
    }
  }, [router]);

  const carregar = useCallback(() => {
    listarArquivosDaConta()
      .then((lista) => setArquivos(lista))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const aoSelecionar = async (selecionados: File[]) => {
    if (!selecionados.length || enviando) return;
    setEnviando(true);
    setErro('');
    setMensagem('');

    const aceitos: File[] = [];
    let grandes = 0;
    let invalidos = 0;
    for (const file of selecionados) {
      if (!/\.(png|jpe?g|webp|pdf)$/i.test(file.name)) { invalidos++; continue; }
      if (file.size > LIMITE_BYTES_POR_ARQUIVO) { grandes++; continue; }
      aceitos.push(file);
    }

    if (!aceitos.length) {
      setErro([
        grandes ? `Cada arquivo pode ter no máximo ${Math.round(LIMITE_BYTES_POR_ARQUIVO / (1024 * 1024))} MB.` : '',
        invalidos ? 'Use PNG, JPG, WEBP ou PDF.' : '',
      ].filter(Boolean).join(' '));
      setEnviando(false);
      return;
    }

    const resposta = await enviarParaBiblioteca(aceitos);
    setEnviando(false);
    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }
    const { criados, duplicados, recusados } = resposta.resultado;
    setMensagem([
      criados.length === 1 ? '1 arquivo guardado.' : `${criados.length} arquivos guardados.`,
      duplicados.length ? `${duplicados.length} já estavam na sua biblioteca.` : '',
      recusados.length ? `${recusados.length} não puderam ser enviados.` : '',
    ].filter(Boolean).join(' '));
    carregar();
  };

  const aoRemover = async (arquivo: ArquivoPublico) => {
    setErro('');
    setMensagem('');
    const ok = await removerDaBiblioteca(arquivo.id);
    if (!ok) {
      setErro(`Não consegui remover "${arquivo.nome}".`);
      return;
    }
    setArquivos((atuais) => atuais.filter((a) => a.id !== arquivo.id));
    setMensagem(`"${arquivo.nome}" removido.`);
  };

  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary flex items-center gap-2">
          <Library size={28} aria-hidden="true" /> Meus arquivos
        </h1>

        <section className="bg-white rounded-2xl border-2 border-dashed border-ink/20 p-4 sm:p-6">
          <label htmlFor="biblioteca-arquivos" className="block text-xl font-semibold text-ink mb-2">
            Enviar fotos, imagens e PDFs
          </label>
          <p id="ajuda-biblioteca" className="text-ink/70 mb-4">
            Guarde aqui o material que você usa sempre. Depois, ao criar uma revisão ou um dever,
            é só escolher dessa lista: você não precisa enviar de novo.
          </p>
          <input
            ref={inputRef}
            id="biblioteca-arquivos"
            name="biblioteca-arquivos"
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.webp,.pdf"
            aria-describedby="ajuda-biblioteca"
            tabIndex={-1}
            onChange={(e) => {
              const selecionados = Array.from(e.target.files || []);
              e.target.value = '';
              void aoSelecionar(selecionados);
            }}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            className="btn-primary !w-auto !text-lg !py-3 focus-visible:outline-offset-4"
          >
            <Plus size={22} aria-hidden="true" />
            {enviando ? 'Enviando...' : 'Adicionar arquivos'}
          </button>
          <p className="text-sm text-ink/50 mt-3">
            PNG, JPG, WEBP e PDF. Até {MAX_ARQUIVOS_POR_ENVIO} arquivos por envio e{' '}
            {Math.round(LIMITE_BYTES_POR_ARQUIVO / (1024 * 1024))} MB cada.
          </p>
        </section>

        {erro && (
          <div role="alert" className="bg-danger-light border-2 border-danger/40 rounded-2xl p-4 text-danger text-lg font-semibold">
            {erro}
          </div>
        )}
        {mensagem && (
          <p role="status" className="flex items-center gap-2 text-success-ink font-semibold">
            <Upload size={20} aria-hidden="true" /> {mensagem}
          </p>
        )}

        {carregando ? (
          <p className="text-ink/70">Carregando seus arquivos...</p>
        ) : arquivos.length === 0 ? (
          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <Mascote humor="feliz" className="w-20 h-20 animate-float" decorative />
            </div>
            <p className="text-xl font-extrabold text-ink mb-2">Sua biblioteca está vazia.</p>
            <p className="text-ink/70">Envie as fotos e os PDFs que você usa: eles ficam salvos para as próximas revisões e deveres.</p>
          </div>
        ) : (
          <BibliotecaGrid arquivos={arquivos} aoRemover={aoRemover} />
        )}
      </main>
    </>
  );
}
