'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { History, KeyRound } from 'lucide-react';
import Header from '@/components/Header';
import Mascote from '@/components/Mascote';
import { lerToken } from '@/lib/client/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (!lerToken()) router.replace('/login');
  }, [router]);

  return (
    <>
      <Header />
      <main className="shell py-8 space-y-8">
        <section className="text-center py-2">
          <h1 className="flex justify-center mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- ícone da marca (SVG local) */}
            <img src="/logo-icon.svg" alt="Estudo Divertido" className="h-28 sm:h-32 w-auto drop-shadow-sm" />
          </h1>
        </section>

        {/* A ação principal da home é estudar, então ela vem antes dos créditos: o olho da
            criança cai aqui primeiro, e o pacote é consequência, não o caminho. */}
        <section className="card text-center" aria-labelledby="entrar-revisoes">
          <h2 id="entrar-revisoes" className="text-2xl font-extrabold text-ink mb-3">Hora de estudar</h2>
          <p className="text-ink/70 mb-5">
            Na área de revisões você cria uma nova revisão e vê o histórico com as perguntas, as respostas e o resultado.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Mascote humor="feliz" className="w-16 h-16 shrink-0" decorative />
            <Link href="/revisoes" className="btn-primary !w-auto">
              <History size={22} aria-hidden="true" /> Ir para as revisões
            </Link>
          </div>
        </section>

        {/* Planos, saldo, resgate e extrato têm uma área só: /creditos. A home só aponta para lá. */}
        <section className="card text-center" aria-labelledby="entrar-creditos">
          <h2 id="entrar-creditos" className="text-2xl font-extrabold text-ink mb-3">Créditos e pacotes</h2>
          <p className="text-ink/70 mb-5">
            Veja seu saldo, contrate um pacote e cole o código que você recebeu para somar revisões.
          </p>
          <Link href="/creditos" className="btn-secondary !w-auto">
            <KeyRound size={22} aria-hidden="true" /> Ver meus créditos
          </Link>
        </section>
      </main>
    </>
  );
}
