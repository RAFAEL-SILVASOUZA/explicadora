'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Backpack, RotateCcw } from 'lucide-react';
import Header from '@/components/Header';
import Mascote from '@/components/Mascote';
import DeverGrid, { NovoDeverBotao } from '@/components/deveres/DeverGrid';
import { apiFetch, lerToken } from '@/lib/client/api';
import { ResumoDever } from '@/lib/types';

export default function Deveres() {
  const router = useRouter();
  const [deveres, setDeveres] = useState<ResumoDever[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!lerToken()) {
      router.replace('/login');
      return;
    }
  }, [router]);

  const carregar = useCallback(() => {
    setErro('');
    apiFetch('/api/deveres')
      .then(async (res) => {
        if (!res.ok) throw new Error('Não foi possível carregar os deveres.');
        return res.json();
      })
      .then((data) => setDeveres(data))
      .catch((err: Error) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <>
      <Header />
      <main className="shell py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-primary flex items-center gap-2">
            <Backpack size={28} aria-hidden="true" /> Dever de casa
          </h1>
          <NovoDeverBotao />
        </div>

        {carregando ? (
          <p className="text-ink/70">Carregando os deveres...</p>
        ) : erro ? (
          <div className="card text-center border-2 border-danger/40">
            <p className="text-xl font-extrabold text-danger mb-4">{erro}</p>
            <button type="button" onClick={carregar} className="btn-primary !w-auto">
              <RotateCcw size={20} aria-hidden="true" /> Tentar de novo
            </button>
          </div>
        ) : deveres.length === 0 ? (
          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <Mascote humor="pensando" className="w-20 h-20 animate-float" decorative />
            </div>
            <p className="text-xl font-extrabold text-ink mb-2">Nenhum dever por aqui ainda.</p>
            <p className="text-ink/70 mb-5">
              Fotografe o caderno da criança e a Explicadora explica o dever em slides curtos.
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
