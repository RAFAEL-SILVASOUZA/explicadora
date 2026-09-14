'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import RevisaoForm from '@/components/RevisaoForm';
import { Sessao } from '@/lib/types';

export default function Home() {
  const router = useRouter();
  const [sessoes, setSessoes] = useState<Sessao[]>([]);

  useEffect(() => {
    fetch('/api/sessoes')
      .then(r => r.json())
      .then(setSessoes)
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8 sm:p-8">
      <h1 className="text-3xl sm:text-5xl text-center font-bold text-primary mb-4"><BookOpen size={40} className="inline mr-2" /> Estudo Divertido</h1>
      <p className="text-lg sm:text-xl text-center text-gray-600 mb-8">Aprenda brincando com o professor virtual!</p>

      <section className="w-full max-w-2xl mb-12" aria-labelledby="criar-revisao">
        <h2 id="criar-revisao" className="text-2xl font-bold text-gray-700 mb-4">Criar revisão</h2>
        <RevisaoForm />
      </section>

      {sessoes.length > 0 && (
        <div className="w-full max-w-2xl">
          <h2 className="text-xl font-bold text-gray-700 mb-4">Revisões anteriores</h2>
          <div className="space-y-3">
            {sessoes.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/estudar/${s.id}`)}
                className="w-full text-left bg-white p-4 rounded-xl shadow hover:shadow-md transition-shadow"
              >
                <p className="font-semibold text-gray-800 truncate">{s.conteudo_texto.slice(0, 60)}...</p>
                <p className="text-sm text-gray-500">{new Date(s.criada_em).toLocaleDateString('pt-BR')}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
