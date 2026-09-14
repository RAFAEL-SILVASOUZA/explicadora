'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Rocket } from 'lucide-react';
import LoadingQuestoes from '@/components/LoadingQuestoes';
import { MAX_IMAGENS } from '@/lib/constantes';

export default function RevisaoPage() {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [avisoImagens, setAvisoImagens] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro('');

    const formData = new FormData();
    formData.append('texto', texto);
    for (const file of arquivos) {
      formData.append('arquivos', file);
    }

    try {
      const res = await fetch('/api/revisao', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/estudar/${data.id}`);
    } catch (err: any) {
      setErro(err.message || 'Algo deu errado. Tente novamente.');
      setCarregando(false);
    }
  };

  if (carregando) return <LoadingQuestoes />;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-primary mb-6"><FileText size={32} className="inline mr-2" /> Criar Revisão</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="conteudo" className="block text-xl font-semibold text-gray-700 mb-2">Conteúdo da revisão</label>
            <textarea
              id="conteudo"
              name="conteudo"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Cole aqui o conteúdo que quer revisar..."
              className="w-full h-48 text-lg p-4 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none resize-none"
            />
          </div>

          <div>
            <label htmlFor="arquivos" className="block text-xl font-semibold text-gray-700 mb-2">Imagens e PDFs (opcional)</label>
            <input
              id="arquivos"
              name="arquivos"
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.webp,.pdf"
              onChange={(e) => {
                const selecionados = Array.from(e.target.files || []);
                const imagens = selecionados.filter((f) => !f.name.toLowerCase().endsWith('.pdf'));
                if (imagens.length > MAX_IMAGENS) {
                  setAvisoImagens(`Máximo de ${MAX_IMAGENS} imagens. As primeiras ${MAX_IMAGENS} serão usadas.`);
                } else {
                  setAvisoImagens('');
                }
                setArquivos(selecionados);
              }}
              className="w-full text-lg p-4 rounded-xl border-2 border-dashed border-gray-300 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:bg-primary file:text-white file:font-semibold file:text-lg hover:file:bg-blue-600 cursor-pointer"
            />
            {arquivos.length > 0 && (
              <p className="text-gray-500 mt-2">{arquivos.length} arquivo(s) selecionado(s)</p>
            )}
            {avisoImagens && (
              <p className="text-amber-600 mt-2">{avisoImagens}</p>
            )}
          </div>

          {erro && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 text-red-700 text-lg">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={!texto.trim() && arquivos.length === 0}
            className="w-full bg-primary text-white text-xl font-bold py-4 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Rocket size={24} className="inline mr-2" /> Gerar Questões
          </button>
        </form>
      </div>
    </main>
  );
}
