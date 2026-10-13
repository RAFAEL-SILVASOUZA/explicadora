'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Frown } from 'lucide-react';
import Header from '@/components/Header';
import ProgressoBarra from '@/components/ProgressoBarra';
import QuestaoCard from '@/components/QuestaoCard';
import FeedbackResposta from '@/components/FeedbackResposta';
import LoadingQuestoes from '@/components/LoadingQuestoes';
import { Questao, Resposta } from '@/lib/types';
import { apiFetch, lerToken } from '@/lib/client/api';

export default function EstudarPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [feedback, setFeedback] = useState<{ correto: boolean; explicacao: string } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!lerToken()) {
      router.replace('/login');
      return;
    }
    apiFetch(`/api/revisao/${params.id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Não foi possível carregar a revisão.');
        setQuestoes(data.questoes);
        setRespostas(data.respostas);
        const respondidas = data.respostas.length;
        if (respondidas >= data.questoes.length) {
          router.push(`/resultado/${params.id}`);
        } else {
          setIndiceAtual(respondidas);
        }
      })
      .catch((err: Error) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [params.id, router]);

  const handleResponder = async (resposta: string, imagem?: string) => {
    setCarregando(true);
    try {
      const res = await apiFetch(`/api/revisao/${params.id}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questaoId: questoes[indiceAtual].id, resposta, ...(imagem && { imagem }) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Não foi possível enviar a resposta.');
      setFeedback({ correto: data.correto, explicacao: data.explicacao });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar a resposta.');
    } finally {
      setCarregando(false);
    }
  };

  const handleProxima = useCallback(() => {
    const proximo = indiceAtual + 1;
    if (proximo >= questoes.length) {
      // Mantém o feedback na tela (em vez de voltar a mostrar a questão)
      // enquanto a navegação para o resultado acontece.
      router.push(`/resultado/${params.id}`);
    } else {
      setFeedback(null);
      setIndiceAtual(proximo);
    }
  }, [indiceAtual, questoes.length, params.id, router]);

  if (carregando && questoes.length === 0) {
    return (
      <>
        <Header />
        {/* Sem barra aqui: antes das questões chegarem ela diria "Questão 1 de 1 · 100%",
            um progresso que ainda não existe. O mascote pensando já comunica a espera. */}
        <main className="max-w-2xl mx-auto px-4 py-8">
          <LoadingQuestoes />
        </main>
      </>
    );
  }

  if (erro) {
    return (
      <>
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="card text-center border-2 border-danger/40">
            <p className="text-2xl font-extrabold text-danger-ink mb-4">
              <Frown size={32} className="inline mr-2" aria-hidden="true" /> {erro}
            </p>
            <button type="button" onClick={() => router.push('/')} className="btn-primary">
              Voltar ao início
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <ProgressoBarra atual={indiceAtual + 1} total={questoes.length} />
        {feedback ? (
          <FeedbackResposta
            correto={feedback.correto}
            explicacao={feedback.explicacao}
            onProxima={handleProxima}
            isLast={indiceAtual + 1 >= questoes.length}
          />
        ) : (
          <QuestaoCard questao={questoes[indiceAtual]} onResponder={handleResponder} enviando={carregando} />
        )}
      </main>
    </>
  );
}
