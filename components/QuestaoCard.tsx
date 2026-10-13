'use client';

import { useState } from 'react';
import { Pencil, Lightbulb, Loader2 } from 'lucide-react';
import { Questao } from '@/lib/types';
import CanvasModal from './CanvasModal';
import Mascote from './Mascote';

export default function QuestaoCard({
  questao,
  onResponder,
  enviando = false,
}: {
  questao: Questao;
  onResponder: (resposta: string, imagem?: string) => void;
  enviando?: boolean;
}) {
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [digitada, setDigitada] = useState('');
  const [showCanvas, setShowCanvas] = useState(false);

  const opcoes = questao.opcoes;
  const isMultipla = questao.tipo === 'multipla_escolha';

  const handleResponder = () => {
    if (enviando) return;
    const resposta = isMultipla ? selecionada : digitada;
    if (resposta) onResponder(resposta);
  };

  const handleSendDrawing = (base64: string) => {
    setShowCanvas(false);
    onResponder('desenho', base64);
  };

  return (
    <div className="card max-w-2xl mx-auto animate-pop-in">
      <div className="flex items-center gap-3 mb-5">
        <Mascote humor="pensando" className="w-14 h-14 shrink-0 animate-float" decorative />
        <h2 className="text-enunciado font-extrabold text-ink leading-snug">{questao.enunciado}</h2>
      </div>

      {questao.dica && (
        <div className="mb-6 flex items-start gap-3 bg-secondary-light border-2 border-secondary/30 rounded-2xl p-4">
          <Lightbulb size={28} className="text-secondary-ink shrink-0 mt-1" />
          <div>
            <p className="font-extrabold text-secondary-ink mb-1">Dica para te ajudar</p>
            <p className="text-lg text-ink/80">{questao.dica}</p>
          </div>
        </div>
      )}

      {isMultipla ? (
        <div className="space-y-3 mb-6">
          {opcoes.map((opcao, i) => (
            <button
              key={i}
              onClick={() => setSelecionada(opcao)}
              disabled={enviando}
              className={`w-full text-left text-opcao p-4 rounded-2xl border-2 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed ${
                selecionada === opcao
                  ? 'border-primary bg-primary-light text-primary-dark font-extrabold shadow-card animate-pop-in'
                  : 'border-ink/15 hover:border-primary hover:bg-primary-light'
              }`}
            >
              <span className="chip">{String.fromCharCode(65 + i)}</span>
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
            disabled={enviando}
            className="w-full text-opcao p-4 rounded-2xl border-2 border-ink/15 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={() => setShowCanvas(true)}
            disabled={enviando}
            className="mt-3 flex items-center gap-2 text-primary font-bold hover:text-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Pencil size={20} />
            Ou desenhe a fórmula
          </button>
        </div>
      )}

      <button
        onClick={handleResponder}
        disabled={enviando || !(isMultipla ? selecionada !== null : digitada.trim().length > 0)}
        aria-busy={enviando || undefined}
        className="btn-primary mt-2"
      >
        {enviando && <Loader2 size={22} className="animate-spin" />}
        {enviando ? 'Enviando...' : 'Responder'}
      </button>

      {showCanvas && (
        <CanvasModal onClose={() => setShowCanvas(false)} onSend={handleSendDrawing} />
      )}
    </div>
  );
}
