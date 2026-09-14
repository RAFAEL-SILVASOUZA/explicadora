'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, Dumbbell, MessageSquare, Frown } from 'lucide-react';

interface Resultado {
  veredito: string;
  acertos: number;
  total: number;
  percentual: number;
}

export default function ResultadoPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch(`/api/revisao/${params.id}/finalizar`, { method: 'POST' })
      .then(r => r.json())
      .then(setResultado)
      .catch(err => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [params.id]);

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 animate-bounce"><Trophy size={64} /></div>
          <p className="text-2xl">Calculando resultado...</p>
        </div>
      </div>
    );
  }

  if (erro || !resultado) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-8 max-w-md text-center">
          <p className="text-2xl mb-4"><Frown size={32} className="inline mr-2" /> {erro || 'Erro ao carregar resultado'}</p>
          <button onClick={() => router.push('/')} className="bg-primary text-white px-6 py-3 rounded-xl text-lg">
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  const preparado = resultado.percentual >= 70;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-6">{preparado ? <Trophy size={72} className="text-amber-500" /> : <Dumbbell size={72} className="text-blue-500" />}</div>
        <h1 className="text-4xl font-bold text-primary mb-4">
          {preparado ? 'Você está preparado!' : 'Continue praticando!'}
        </h1>

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="text-6xl font-bold text-gray-800 mb-2">{resultado.percentual}%</div>
          <p className="text-xl text-gray-600">
            {resultado.acertos} de {resultado.total} questões corretas
          </p>
        </div>

        <div className={`rounded-2xl p-8 mb-6 ${preparado ? 'bg-green-50 border-2 border-green-300' : 'bg-amber-50 border-2 border-amber-300'}`}>
          <h2 className="text-2xl font-bold mb-4"><MessageSquare size={24} className="inline mr-2" /> O que o professor diz:</h2>
          <p className="text-xl text-gray-700">{resultado.veredito}</p>
        </div>

        <button
          onClick={() => router.push('/')}
          className="bg-primary text-white text-xl font-bold px-12 py-4 rounded-xl hover:bg-blue-600 transition-colors"
        >
          Voltar ao Início
        </button>
      </div>
    </main>
  );
}
