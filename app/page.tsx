'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Pencil } from 'lucide-react';
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
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold text-primary mb-4"><BookOpen size={48} className="inline mr-3" /> Estudo Divertido</h1>
      <p className="text-xl text-gray-600 mb-8">Aprenda brincando com o professor virtual!</p>

      <button
        onClick={() => router.push('/revisao')}
        className="bg-primary text-white text-2xl font-bold px-12 py-6 rounded-2xl hover:bg-blue-600 transition-colors shadow-lg mb-12"
      >
        <Pencil size={24} className="inline mr-2" /> Criar Revisão
      </button>

      {sessoes.length > 0 && (
        <div className="w-full max-w-md">
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
