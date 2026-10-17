'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Backpack } from 'lucide-react';
import Header from '@/components/Header';
import Mascote from '@/components/Mascote';
import DeverGrid, { NovoDeverBotao } from '@/components/deveres/DeverGrid';
import { apiFetch, lerToken } from '@/lib/client/api';
import { ResumoDever } from '@/lib/types';

export default function Deveres() {
  const router = useRouter();
  const [deveres, setDeveres] = useState<ResumoDever[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!lerToken()) {
      router.replace('/login');
      return;
    }
  }, [router]);

  const carregar = useCallback(() => {
    apiFetch('/api/deveres')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setDeveres(data); })
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
            <Backpack size={28} aria-hidden="true" /> Dever de casa
          </h1>
          <NovoDeverBotao />
        </div>

        {carregando ? (
          <p className="text-ink/70">Carregando os deveres...</p>
        ) : deveres.length === 0 ? (
          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <Mascote humor="pensando" className="w-20 h-20 animate-float" decorative />
            </div>
            <p className="text-xl font-extrabold text-ink mb-2">Nenhum dever por aqui ainda.</p>
            <p className="text-ink/70 mb-5">
              Fotografe o caderno da criança e a Lia explica o dever em desenhos e áudio.
            </p>
            <NovoDeverBotao />
          </div>
        ) : (
          <DeverGrid deveres={deveres} />
        )}
      </main>
    </>
  );
}
