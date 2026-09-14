'use client';

import { useState } from 'react';
import { Pencil, Lightbulb } from 'lucide-react';
import { Questao } from '@/lib/types';
import CanvasModal from './CanvasModal';

export default function QuestaoCard({ questao, onResponder }: { questao: Questao; onResponder: (resposta: string, imagem?: string) => void }) {
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [digitada, setDigitada] = useState('');
  const [showCanvas, setShowCanvas] = useState(false);

  const opcoes = JSON.parse(questao.opcoes_json) as string[];
  const isMultipla = questao.tipo === 'multipla_escolha';

  const handleResponder = () => {
    const resposta = isMultipla ? selecionada : digitada;
    if (resposta) onResponder(resposta);
  };

  const handleSendDrawing = (base64: string) => {
    setShowCanvas(false);
    onResponder('desenho', base64);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 max-w-2xl mx-auto">
      <h2 className="text-enunciado font-bold text-gray-800 mb-4">{questao.enunciado}</h2>

      {questao.dica && (
        <div className="mb-6 flex items-start gap-3 bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
          <Lightbulb size={28} className="text-amber-500 shrink-0 mt-1" />
          <div>
            <p className="font-bold text-amber-700 mb-1">Dica para te ajudar</p>
            <p className="text-lg text-gray-700">{questao.dica}</p>
          </div>
        </div>
      )}

      {isMultipla ? (
        <div className="space-y-3 mb-6">
          {opcoes.map((opcao, i) => (
            <button
              key={i}
              onClick={() => setSelecionada(opcao)}
              className={`w-full text-left text-opcao p-4 rounded-xl border-2 transition-all ${
                selecionada === opcao
                  ? 'border-primary bg-blue-50 text-primary font-bold'
                  : 'border-gray-200 hover:border-primary hover:bg-blue-50'
              }`}
            >
              <span className="font-bold mr-2">{String.fromCharCode(65 + i)})</span>
              {opcao}
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-6">
          <input
            type="text"
            value={digitada}
            onChange={(e) => setDigitada(e.target.value)}
            placeholder="Digite sua resposta..."
            className="w-full text-opcao p-4 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none"
          />
          <button
            onClick={() => setShowCanvas(true)}
            className="mt-3 flex items-center gap-2 text-primary font-semibold hover:text-blue-600"
          >
            <Pencil size={20} />
            Ou desenhe a fórmula
          </button>
        </div>
      )}

      <button
        onClick={handleResponder}
        disabled={!(isMultipla ? selecionada !== null : digitada.trim().length > 0)}
        className="w-full bg-primary text-white text-xl font-bold py-4 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Responder
      </button>

      {showCanvas && (
        <CanvasModal onClose={() => setShowCanvas(false)} onSend={handleSendDrawing} />
      )}
    </div>
  );
}
