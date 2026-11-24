'use client';

import { useCallback, useEffect, useState } from 'react';
import { History, Target, Backpack, BookOpen, RotateCcw } from 'lucide-react';
import { apiFetch } from '@/lib/client/api';
import type { ResumoHome } from '@/lib/resumo';
import StatCard from '@/components/StatCard';
import { SkeletonStatCard } from '@/components/Skeleton';

// O placar da home: um único fetch em /api/resumo (que devolve os totais calculados)
// e os quatro cartões renderizados a partir dele. Nenhuma fórmula vive aqui — se um
// número precisar mudar de lugar, muda em lib/resumo.ts.

export default function ProgressoHome() {
  const [resumo, setResumo] = useState<ResumoHome | null>(null);
  // Três estados, três telas: espera, falha e dado. Um estado de espera não é um
  // resultado — nenhum cartão mostra número enquanto a espera durar (mesmo princípio
  // da barra de /estudar).
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro'>('carregando');

  const carregar = useCallback(() => {
    setEstado('carregando');
    apiFetch('/api/resumo')
      .then(async (res) => {
        if (!res.ok) throw new Error('Não foi possível carregar seu progresso.');
        return res.json();
      })
      .then((data: ResumoHome) => { setResumo(data); setEstado('ok'); })
      .catch(() => setEstado('erro'));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (estado === 'erro') {
    return (
      <section aria-labelledby="progresso-titulo">
        <h2 id="progresso-titulo" className="text-xl font-extrabold text-ink mb-3">Seu progresso</h2>
        <div className="card text-center">
          <p className="text-lg font-extrabold text-danger-ink mb-4">Não foi possível carregar seu progresso.</p>
          <button type="button" onClick={carregar} className="btn-primary !w-auto">
            <RotateCcw size={20} aria-hidden="true" /> Tentar de novo
          </button>
        </div>
      </section>
    );
  }

  if (estado === 'carregando' || !resumo) {
    return (
      <section aria-labelledby="progresso-titulo" aria-busy="true">
        <span className="sr-only" role="status">Carregando seu progresso…</span>
        <h2 id="progresso-titulo" className="text-xl font-extrabold text-ink mb-3">Seu progresso</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
      </section>
    );
  }

  const chipRevisoes = resumo.revisoesEstaSemana > 0 ? `+${resumo.revisoesEstaSemana} esta semana` : null;
  const chipDeveres = resumo.deveresEstaSemana > 0 ? `+${resumo.deveresEstaSemana} esta semana` : null;

  return (
    <section aria-labelledby="progresso-titulo">
      <h2 id="progresso-titulo" className="text-xl font-extrabold text-ink mb-3">Seu progresso</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          href="/revisoes"
          icon={History}
          iconClasse="bg-primary-light text-primary-dark"
          numero={String(resumo.revisoes)}
          rotulo="Revisões feitas"
          caption={
            resumo.revisoes === 0
              ? 'Nenhuma revisão ainda — comece!'
              : `${resumo.revisoesFinalizadas} de ${resumo.revisoes} finalizadas`
          }
          destaque={chipRevisoes}
        />
        <StatCard
          href="/revisoes"
          icon={Target}
          iconClasse="bg-success-light text-success-ink"
          numero={resumo.percentualAcertos != null ? `${resumo.percentualAcertos}%` : '—'}
          rotulo="Taxa de acertos"
          caption={
            resumo.totalQuestoes === 0
              ? 'Responda uma revisão para ver sua nota'
              : `${resumo.acertos} de ${resumo.totalQuestoes} perguntas certas`
          }
        />
        <StatCard
          href="/deveres"
          icon={Backpack}
          iconClasse="bg-secondary-light text-secondary-ink"
          numero={String(resumo.deveres)}
          rotulo="Deveres feitos"
          caption={
            resumo.deveres === 0
              ? 'Nenhum dever ainda — comece!'
              : `${resumo.deveresConcluidos} de ${resumo.deveres} concluídos`
          }
          destaque={chipDeveres}
        />
        <StatCard
          href="/deveres"
          icon={BookOpen}
          iconClasse="bg-star text-ink"
          numero={resumo.percentualLeitura != null ? `${resumo.percentualLeitura}%` : '—'}
          rotulo="Leitura de deveres"
          caption={
            resumo.slidesTotal === 0
              ? 'Leia um dever para ver sua leitura'
              : `${resumo.slidesLidos} de ${resumo.slidesTotal} slides lidos`
          }
          progresso={resumo.percentualLeitura}
        />
      </div>
    </section>
  );
}
