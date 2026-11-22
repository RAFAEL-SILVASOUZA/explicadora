'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  slideAtual: number;
  totalSlides: number;
  onAnterior: () => void;
  onProximo: () => void;
}

// Navegação de slides: o aluno lê um slide e avança. Setas do teclado também
// funcionam (o handler fica na página).
export default function ControlesSlides(p: Props) {
  return (
    <div className="card flex items-center gap-3">
      <p className="font-extrabold text-ink text-lg mr-auto" aria-live="polite">
        Slide {p.slideAtual} de {p.totalSlides}
      </p>

      <button type="button" onClick={p.onAnterior} disabled={p.slideAtual <= 1}
        className="btn-secondary !w-auto" aria-label="Slide anterior">
        <ChevronLeft size={22} aria-hidden="true" />
      </button>

      <button type="button" onClick={p.onProximo} disabled={p.slideAtual >= p.totalSlides}
        className="btn-primary !w-auto !px-6" aria-label="Próximo slide">
        <ChevronRight size={22} aria-hidden="true" />
      </button>
    </div>
  );
}
