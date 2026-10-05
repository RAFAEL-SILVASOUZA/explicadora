'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Rocket, Trash2 } from 'lucide-react';
import LoadingQuestoes from '@/components/LoadingQuestoes';
import { MAX_IMAGENS } from '@/lib/constantes';

export default function RevisaoForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState('');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [avisoImagens, setAvisoImagens] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (carregando || (!texto.trim() && arquivos.length === 0)) return;
    setCarregando(true);
    setErro('');

    const formData = new FormData();
    formData.append('texto', texto.trim());
    for (const file of arquivos) {
      formData.append('arquivos', file);
    }

    try {
      const res = await fetch('/api/revisao', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/estudar/${data.id}`);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Algo deu errado. Tente novamente.');
      setCarregando(false);
    }
  };

  if (carregando) return <LoadingQuestoes />;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="conteudo" className="block text-xl font-semibold text-gray-700 mb-2">Conteúdo da revisão</label>
        <textarea
          id="conteudo"
          name="conteudo"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Se quiser, cole ou escreva o conteúdo para revisar..."
          className="w-full h-36 text-base sm:text-lg p-4 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none resize-y"
        />
      </div>

      <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-4 sm:p-6">
        <label htmlFor="arquivos" className="block text-xl font-semibold text-gray-700 mb-2">Imagens e PDFs (opcional)</label>
        <p id="ajuda-arquivos" className="text-gray-600 mb-4">Adicione um arquivo por vez ou vários juntos. Confirme a seleção no seu aparelho e adicione mais quando quiser.</p>
        <input
          ref={inputRef}
          id="arquivos"
          name="arquivos"
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.pdf"
          aria-describedby="ajuda-arquivos"
          tabIndex={-1}
          onChange={(e) => {
            const selecionados = Array.from(e.target.files || []);
            e.target.value = '';
            if (!selecionados.length) return;
            let imagens = arquivos.filter(f => !f.name.toLowerCase().endsWith('.pdf')).length;
            let excedentes = 0;
            let invalidos = 0;
            const aceitos = selecionados.filter(file => {
              if (!/\.(png|jpe?g|webp|pdf)$/i.test(file.name)) {
                invalidos++;
                return false;
              }
              if (file.name.toLowerCase().endsWith('.pdf')) return true;
              if (imagens >= MAX_IMAGENS) {
                excedentes++;
                return false;
              }
              imagens++;
              return true;
            });
            setArquivos(anteriores => [...anteriores, ...aceitos]);
            setAvisoImagens([
              excedentes ? `Máximo de ${MAX_IMAGENS} imagens no total. ${excedentes} imagem(ns) não adicionada(s).` : '',
              invalidos ? 'Alguns arquivos não foram adicionados. Use PNG, JPG, WEBP ou PDF.' : '',
            ].filter(Boolean).join(' '));
            setErro('');
          }}
          className="sr-only"
        />
        <button type="button" onClick={() => inputRef.current?.click()} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-white font-semibold px-5 py-3 rounded-xl hover:bg-blue-600 focus-visible:outline-offset-4">
          <Plus size={22} aria-hidden="true" />
          {arquivos.length ? 'Adicionar mais arquivos' : 'Adicionar imagens ou PDFs'}
        </button>
        <p className="text-sm text-gray-500 mt-3">PNG, JPG, WEBP e PDF. Até {MAX_IMAGENS} imagens no total.</p>
        <p role="status" className="text-gray-700 mt-4 font-medium">
          {arquivos.length === 0
            ? 'Nenhum arquivo adicionado ainda.'
            : arquivos.length === 1
              ? '1 arquivo adicionado'
              : `${arquivos.length} arquivos adicionados`}
        </p>
        {arquivos.length > 0 && (
          <ul className="mt-3 space-y-2" aria-label="Arquivos adicionados">
            {arquivos.map((file, index) => (
              <li key={index} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                <FileText size={24} className="shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-gray-800 break-all">{file.name}</p>
                  <p className="text-sm text-gray-500">{Math.max(1, Math.ceil(file.size / 1024))} KB</p>
                </div>
                <button type="button" aria-label={`Remover ${file.name}`} onClick={() => {
                  setArquivos(anteriores => anteriores.filter((_, i) => i !== index));
                  setAvisoImagens('');
                }} className="shrink-0 p-3 rounded-lg text-red-600 hover:bg-red-50 focus-visible:outline-offset-2">
                  <Trash2 size={20} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {avisoImagens && (
          <p role="alert" className="text-amber-700 mt-2">{avisoImagens}</p>
        )}
      </div>

      {erro && (
        <div role="alert" className="bg-red-50 border-2 border-red-300 rounded-xl p-4 text-red-700 text-lg">
          {erro}
        </div>
      )}

      <p className="text-gray-600 text-center">Tudo pronto? As questões serão geradas com o texto e todos os arquivos da lista.</p>
      <button
        type="submit"
        disabled={!texto.trim() && arquivos.length === 0}
        className="w-full bg-primary text-white text-xl font-bold py-4 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Rocket size={24} className="inline mr-2" /> Gerar Questões
      </button>
    </form>
  );
}
