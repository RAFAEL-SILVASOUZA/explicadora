'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { History } from 'lucide-react';
import Header from '@/components/Header';
import Mascote from '@/components/Mascote';
import RevisaoGrid, { NovaRevisaoBotao } from '@/components/RevisaoGrid';
import { apiFetch, lerToken } from '@/lib/client/api';
import { ResumoRevisao } from '@/lib/types';

export default function Revisoes() {
  const router = useRouter();
  const [revisoes, setRevisoes] = useState<ResumoRevisao[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!lerToken()) {
      router.replace('/login');
      return;
    }
  }, [router]);

  const carregar = useCallback(() => {
    apiFetch('/api/revisoes')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setRevisoes(data); })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-primary flex items-center gap-2">
            <History size={28} aria-hidden="true" /> Área de revisões
          </h1>
          <NovaRevisaoBotao />
        </div>

        {carregando ? (
          <p className="text-ink/70">Carregando suas revisões...</p>
        ) : revisoes.length === 0 ? (
          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <Mascote humor="feliz" className="w-20 h-20 animate-float" decorative />
            </div>
            <p className="text-xl font-extrabold text-ink mb-2">Você ainda não tem revisões.</p>
            <p className="text-ink/70 mb-5">Escolha um assunto e a Lia cria as perguntas para você.</p>
            <NovaRevisaoBotao />
          </div>
        ) : (
          <RevisaoGrid revisoes={revisoes} />
        )}
      </main>
    </>
  );
}
