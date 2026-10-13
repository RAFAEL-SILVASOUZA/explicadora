'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Frown, Trophy, MessageSquare, Play } from 'lucide-react';
import Header from '@/components/Header';
import MascoteCoruja from '@/components/MascoteCoruja';
import RespostaItem from '@/components/RespostaItem';
import { tituloDaRevisao } from '@/components/RevisaoGrid';
import { apiFetch, lerToken } from '@/lib/client/api';
import { Questao, ResultadoRevisao, Resposta } from '@/lib/types';

interface Dados {
  revisao: { id: string; titulo: string | null; conteudo_texto: string; criado_em: string };
  questoes: Questao[];
  respostas: Resposta[];
  resultado: ResultadoRevisao | null;
}

export default function RevisaoDetalhe({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(() => {
    if (!lerToken()) {
      router.replace('/login');
      return;
    }
    apiFetch(`/api/revisao/${params.id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Não foi possível carregar a revisão.');
        setDados(data);
      })
      .catch((err: Error) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [params.id, router]);

  useEffect(() => { carregar(); }, [carregar]);

  if (carregando) {
    return (
      <>
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="card"><p className="text-2xl font-extrabold text-ink">Carregando...</p></div>
        </main>
      </>
    );
  }

  if (erro || !dados) {
    return (
      <>
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="card text-center border-2 border-danger/40">
            <p className="text-2xl font-extrabold text-danger mb-4">
              <Frown size={32} className="inline mr-2" aria-hidden="true" /> {erro || 'Erro ao carregar a revisão'}
            </p>
            <Link href="/revisoes" className="btn-primary !w-auto">Voltar para as revisões</Link>
          </div>
        </main>
      </>
    );
  }

  const respondidas = dados.respostas.length;
  const total = dados.questoes.length;
  const terminada = total > 0 && respondidas >= total;
  const acertos = dados.respostas.filter((r) => r.correto).length;
  const percentual = total > 0 ? Math.round((acertos / total) * 100) : 0;

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <section className="card">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-primary mb-2">
            {tituloDaRevisao(dados.revisao)}
          </h1>
          <p className="text-ink/60 text-sm mb-4">{new Date(dados.revisao.criado_em).toLocaleDateString('pt-BR')}</p>
          <p className="text-ink/80 whitespace-pre-wrap break-words">{dados.revisao.conteudo_texto}</p>
        </section>

        <section className="card" aria-labelledby="resultado-titulo">
          <h2 id="resultado-titulo" className="text-xl font-extrabold text-ink mb-4 flex items-center gap-2">
            <Trophy size={22} aria-hidden="true" /> Resultado final
          </h2>
          {!terminada || total === 0 ? (
            <p className="text-ink/70 mb-4">
              {total === 0 ? 'Esta revisão ainda não tem questões.' : `Faltam ${total - respondidas} questões para terminar.`}
            </p>
          ) : (
            <>
              <p className="text-4xl font-extrabold text-primary mb-2">{percentual}%</p>
              <p className="text-ink/70 mb-4">{acertos} de {total} questões corretas</p>
              {dados.resultado?.veredito ? (
                <div className="rounded-2xl bg-primary-light/50 p-4">
                  <p className="font-bold text-ink mb-2 flex items-center gap-2">
                    <MessageSquare size={20} aria-hidden="true" /> O que o professor diz
                  </p>
                  <p className="text-ink/80">{dados.resultado.veredito}</p>
                </div>
              ) : (
                <p className="text-ink/70">O veredito aparece na tela de resultado, ao finalizar a revisão.</p>
              )}
            </>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`/estudar/${dados.revisao.id}`} className="btn-primary !w-auto">
              <Play size={20} aria-hidden="true" />
              {terminada ? 'Abrir resultado' : 'Continuar respondendo'}
            </Link>
            <Link href="/revisoes" className="btn-secondary">Voltar para a grid</Link>
          </div>
        </section>

        <section aria-labelledby="perguntas-titulo">
          <h2 id="perguntas-titulo" className="text-xl font-extrabold text-ink mb-4 flex items-center gap-2">
            <MascoteCoruja humor="pensando" className="w-8 h-8 shrink-0" aria-hidden="true" decorative />
            Perguntas e respostas
          </h2>
          {total === 0 ? (
            <p className="text-ink/70">Nenhuma questão gerada ainda.</p>
          ) : (
            <ul className="space-y-3">
              {dados.questoes.map((q, i) => (
                <RespostaItem
                  key={q.id}
                  questao={q}
                  numero={i + 1}
                  resposta={dados.respostas.find((r) => r.questao_id === q.id) ?? null}
                />
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
