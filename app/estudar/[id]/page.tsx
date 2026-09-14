'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Frown } from 'lucide-react';
import ProgressoBarra from '@/components/ProgressoBarra';
import QuestaoCard from '@/components/QuestaoCard';
import FeedbackResposta from '@/components/FeedbackResposta';
import { Questao, Resposta } from '@/lib/types';

export default function EstudarPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [feedback, setFeedback] = useState<{ correto: boolean; explicacao: string } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    fetch(`/api/revisao/${params.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setQuestoes(data.questoes);
        setRespostas(data.respostas);
        const respondidas = data.respostas.length;
        if (respondidas >= data.questoes.length) {
          router.push(`/resultado/${params.id}`);
        } else {
          setIndiceAtual(respondidas);
        }
      })
      .catch(err => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [params.id, router]);

  const handleResponder = async (resposta: string, imagem?: string) => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/revisao/${params.id}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questaoId: questoes[indiceAtual].id, resposta, ...(imagem && { imagem }) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFeedback({ correto: data.correto, explicacao: data.explicacao });
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  const handleProxima = () => {
    const proximo = indiceAtual + 1;
    if (proximo >= questoes.length) {
      // Mantém o feedback na tela (em vez de voltar a mostrar a questão)
      // enquanto a navegação para o resultado acontece.
      router.push(`/resultado/${params.id}`);
    } else {
      setFeedback(null);
      setIndiceAtual(proximo);
    }
  };

  if (carregando && questoes.length === 0) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-2xl">Carregando...</p></div>;
  }

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-8 max-w-md text-center">
          <p className="text-2xl mb-4"><Frown size={32} className="inline mr-2" /> {erro}</p>
          <button onClick={() => router.push('/')} className="bg-primary text-white px-6 py-3 rounded-xl text-lg">
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <ProgressoBarra atual={indiceAtual + 1} total={questoes.length} />
        {feedback ? (
          <FeedbackResposta correto={feedback.correto} explicacao={feedback.explicacao} onProxima={handleProxima} />
        ) : (
          <QuestaoCard questao={questoes[indiceAtual]} onResponder={handleResponder} enviando={carregando} />
        )}
      </div>
    </main>
  );
}
