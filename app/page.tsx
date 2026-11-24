'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { History, KeyRound, Backpack } from 'lucide-react';
import Header from '@/components/Header';
import Mascote from '@/components/Mascote';
import ProgressoHome from '@/components/ProgressoHome';
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
        {/* H1 de marca fora da tela: o hero (e o h1 visual) foi removido; o header já traz
            o ícone, este mantém a hierarquia de títulos. */}
        <h1 className="sr-only">EXPLICADORA</h1>

        {/* O placar vem no topo da tela: responde "onde estou?" de relance antes da
            ação principal. As métricas ficam antes dos cartões de ação de propósito. */}
        <ProgressoHome />

        {/* Estudar é a ação principal da home: duas áreas (revisões e dever de casa),
            cada uma com o seu atalho. Vem antes dos créditos — a ação não é consequência. */}
        <section className="card text-center" aria-labelledby="entrar-estudo">
          <h2 id="entrar-estudo" className="text-2xl font-extrabold text-ink mb-3">Hora de estudar</h2>
          <p className="text-ink/70 mb-5">
            Revise o conteúdo com uma nova revisão ou estude o dever de casa em slides — dois jeitos de estudar.
          </p>
          <div className="flex flex-col items-center gap-4">
            <Mascote humor="feliz" className="w-16 h-16 shrink-0" decorative />
            <div className="flex w-full flex-wrap items-center justify-center gap-3 sm:w-auto">
              <Link href="/revisoes" className="btn-primary w-full sm:w-auto">
                <History size={22} aria-hidden="true" /> Ir para as revisões
              </Link>
              <Link href="/deveres" className="btn-secondary w-full sm:w-auto">
                <Backpack size={22} aria-hidden="true" /> Ir para o dever de casa
              </Link>
            </div>
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
