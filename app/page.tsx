'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, History } from 'lucide-react';
import Header from '@/components/Header';
import PlanosCard from '@/components/PlanosCard';
import ResgateTokenCard from '@/components/ResgateTokenCard';
import { apiFetch, lerToken } from '@/lib/client/api';
import { Plano } from '@/lib/types';

export default function Home() {
  const router = useRouter();
  const [planos, setPlanos] = useState<Plano[]>([]);

  useEffect(() => {
    if (!lerToken()) {
      router.replace('/login');
      return;
    }
    apiFetch('/api/planos')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setPlanos(data); })
      .catch(() => {});
  }, [router]);

  const carregarPlanos = useCallback(() => {
    apiFetch('/api/planos')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setPlanos(data); })
      .catch(() => {});
  }, []);

  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <section className="text-center">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-primary mb-3">
            <BookOpen size={40} className="inline mr-2" aria-hidden="true" /> Estudo Divertido
          </h1>
          <p className="text-lg text-ink/70">Aprenda brincando com o professor virtual!</p>
        </section>

        <PlanosCard planos={planos} />
        <ResgateTokenCard onResgate={carregarPlanos} />

        <section className="card text-center" aria-labelledby="entrar-revisoes">
          <h2 id="entrar-revisoes" className="text-2xl font-extrabold text-ink mb-3">Hora de estudar</h2>
          <p className="text-ink/70 mb-5">
            Na área de revisões você cria uma nova revisão e vê o histórico com as perguntas, as respostas e o resultado.
          </p>
          <Link href="/revisoes" className="btn-primary !w-auto">
            <History size={22} aria-hidden="true" /> Ir para as revisões
          </Link>
        </section>
      </main>
    </>
  );
}
