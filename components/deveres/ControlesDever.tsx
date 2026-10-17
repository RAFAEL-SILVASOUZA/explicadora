'use client';

import { ChevronLeft, ChevronRight, FileText, Pause, Play, RotateCcw } from 'lucide-react';

interface Props {
  tocando: boolean;
  passoAtual: number;
  totalPassos: number;
  temTranscricao: boolean;
  onPlayPause: () => void;
  onAnterior: () => void;
  onProximo: () => void;
  onRepetir: () => void;
  onAbrirTranscricao: () => void;
}

export default function ControlesDever(p: Props) {
  return (
    <div className="card flex flex-wrap items-center gap-3">
      <p className="font-extrabold text-ink text-lg mr-auto" aria-live="polite">
        Passo {p.passoAtual} de {p.totalPassos}
      </p>

      <button type="button" onClick={p.onAnterior} disabled={p.passoAtual <= 1}
        className="btn-secondary !w-auto" aria-label="Passo anterior">
        <ChevronLeft size={22} aria-hidden="true" />
      </button>

      <button type="button" onClick={p.onPlayPause} className="btn-primary !w-auto !px-6"
        aria-label={p.tocando ? 'Pausar a explicação' : 'Ouvir a explicação'}>
        {p.tocando ? <Pause size={24} aria-hidden="true" /> : <Play size={24} aria-hidden="true" />}
      </button>

      <button type="button" onClick={p.onRepetir} className="btn-secondary !w-auto" aria-label="Repetir este passo">
        <RotateCcw size={22} aria-hidden="true" /> Repetir
      </button>

      <button type="button" onClick={p.onProximo} disabled={p.passoAtual >= p.totalPassos}
        className="btn-secondary !w-auto" aria-label="Próximo passo">
        <ChevronRight size={22} aria-hidden="true" />
      </button>

      {p.temTranscricao && (
        <button type="button" onClick={p.onAbrirTranscricao} className="btn-secondary !w-auto" aria-label="Ver texto da explicação">
          <FileText size={20} aria-hidden="true" /> Ver texto
        </button>
      )}
    </div>
  );
}
