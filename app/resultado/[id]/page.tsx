'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, Dumbbell, MessageSquare, Frown, RotateCcw, Rocket, Sparkles } from 'lucide-react';
import Header from '@/components/Header';
import LoadingQuestoes from '@/components/LoadingQuestoes';
import MascoteCoruja from '@/components/MascoteCoruja';
import { apiFetch, lerToken } from '@/lib/client/api';

interface Resultado {
  veredito: string;
  acertos: number;
  total: number;
  percentual: number;
}

export default function ResultadoPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<'reiniciar' | 'avancar' | null>(null);
  const [erroAcao, setErroAcao] = useState('');

  useEffect(() => {
    if (!lerToken()) {
      router.replace('/login');
      return;
    }
    apiFetch(`/api/revisao/${params.id}/finalizar`, { method: 'POST' })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Erro ao carregar resultado.');
        setResultado(data);
      })
      .catch((err: Error) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [params.id, router]);

  if (carregando && !processando) {
    return (
      <>
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <LoadingQuestoes />
        </main>
      </>
    );
  }

  if (erro || !resultado) {
    return (
      <>
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="card text-center border-2 border-danger/40">
            <p className="text-2xl font-extrabold text-danger mb-4">
              <Frown size={32} className="inline mr-2" aria-hidden="true" /> {erro || 'Erro ao carregar resultado'}
            </p>
            <button type="button" onClick={() => router.push('/')} className="btn-primary">
              Voltar ao início
            </button>
          </div>
        </main>
      </>
    );
  }

  const cemPorCento = resultado.percentual === 100;
  const preparado = resultado.percentual >= 70;
  const textoAvancar = cemPorCento ? 'Próximo nível!' : 'Desafio extra liberado!';

  const handleReiniciar = async () => {
    setProcessando('reiniciar');
    setErroAcao('');
    try {
      const res = await apiFetch(`/api/revisao/${params.id}/reiniciar`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Não foi possível reiniciar.');
      router.push(`/estudar/${params.id}`);
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Não foi possível reiniciar.');
      setProcessando(null);
    }
  };

  const handleAvancar = async () => {
    setProcessando('avancar');
    setErroAcao('');
    try {
      const res = await apiFetch(`/api/revisao/${params.id}/avancar`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Não foi possível avançar.');
      router.push(`/estudar/${params.id}`);
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Não foi possível avançar.');
      setProcessando(null);
    }
  };

  if (processando === 'avancar') {
    return (
      <>
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <LoadingQuestoes />
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="flex justify-center mb-6">
          <MascoteCoruja humor="celebrando" className="w-24 h-24 animate-float" aria-hidden="true" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-primary mb-4">
          {cemPorCento ? 'Incrível! Você acertou tudo!' : preparado ? 'Você está preparado!' : 'Continue praticando!'}
        </h1>

        <div className="card mb-6">
          <div className="text-6xl font-extrabold text-ink mb-2">{resultado.percentual}%</div>
          <p className="text-xl text-ink/70">
            {resultado.acertos} de {resultado.total} questões corretas
          </p>
        </div>

        <div className={`card mb-6 ${preparado ? 'border-2 border-success/40' : 'border-2 border-secondary/40'}`}>
          <h2 className="text-2xl font-extrabold mb-4 flex items-center gap-2">
            <MessageSquare size={24} aria-hidden="true" /> O que o professor diz
          </h2>
          <p className="text-xl text-ink/80">{resultado.veredito}</p>
        </div>

        {erroAcao && (
          <div role="alert" className="card border-2 border-danger/40 text-danger font-semibold mb-4">
            {erroAcao}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-4">
          <button type="button" onClick={handleReiniciar} disabled={processando !== null} className="btn-secondary">
            <RotateCcw size={22} aria-hidden="true" />
            {processando === 'reiniciar' ? 'Preparando...' : 'Segunda chance!'}
          </button>

          <button type="button" onClick={handleAvancar} disabled={processando !== null} className="btn-primary !w-auto">
            {cemPorCento ? <Rocket size={22} aria-hidden="true" /> : <Sparkles size={22} aria-hidden="true" />}
            {textoAvancar}
          </button>
        </div>

        <button type="button" onClick={() => router.push('/')} className="text-ink/60 text-lg font-semibold hover:text-ink transition-colors">
          Voltar ao início
        </button>
      </main>
    </>
  );
}
