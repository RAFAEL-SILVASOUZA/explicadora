'use client';

export type Humor = 'neutro' | 'feliz' | 'pensando' | 'triste' | 'celebrando';

interface MascoteProps {
  humor?: Humor;
  className?: string;
  // Decorativa: o SVG é enfeite ao lado de um texto que já diz o que é. Sem role/label
  // ele não entra na árvore de acessibilidade, senão o nome do heading fica duplicado.
  decorative?: boolean;
}

/**
 * "Lia", o mascote do app: uma menina de cabelo bob, desenho original (não é a coruja
 * de outro produto). As expressões trocam conforme o humor.
 * As cores vêm dos tokens do design system pelas utilidades fill e stroke do Tailwind;
 * `skin` é o token do personagem. O bob é o que a mantém reconhecível em 32px (Header).
 */
export default function Mascote({
  humor = 'neutro', className = '', decorative = false,
}: MascoteProps) {
  const sorri = humor === 'feliz' || humor === 'celebrando';

  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role={decorative ? 'presentation' : 'img'}
      aria-label={decorative ? undefined : `Lia, mascote (${humor})`}
      aria-hidden={decorative || undefined}
    >
      {/* Cabelo bob: a silhueta da personagem */}
      <path
        d="M60 18 C40 18 26 33 26 53 C26 70 30 82 36 86 C44 82 52 80 60 80
           C68 80 76 82 84 86 C90 82 94 70 94 53 C94 33 80 18 60 18 Z"
        className="fill-primary-dark"
      />

      {/* Rosto */}
      <ellipse cx="60" cy="54" rx="24" ry="26" className="fill-skin" />

      {/* Franja, cobrindo a testa */}
      <path
        d="M36 44 C42 30 54 26 62 36 C70 28 80 32 84 44 C74 42 66 42 60 44 C52 44 44 44 36 44 Z"
        className="fill-primary-dark"
      />

      {/* Pescoço */}
      <rect x="54" y="74" width="12" height="18" rx="5" className="fill-skin" />

      {/* Ombros */}
      <path d="M18 120 C18 102 34 92 60 92 C86 92 102 102 102 120 Z" className="fill-primary" />

      {/* Colarinho e gravata: o detalhe que dá identidade à personagem */}
      <path d="M52 94 L60 104 L68 94" className="stroke-white" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M60 104 L56 110 L60 118 L64 110 Z" className="fill-secondary" />

      {/* Olhos */}
      {humor === 'celebrando' ? (
        <>
          {/* Olhos fechados de alegria (arcs) */}
          <path d="M44 54 Q50 48 56 54" className="stroke-ink" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M64 54 Q70 48 76 54" className="stroke-ink" strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      ) : humor === 'pensando' ? (
        <>
          {/* Pupila olhando para cima: ela está raciocinando */}
          <circle cx="52" cy="52" r="6" className="fill-ink" />
          <circle cx="72" cy="52" r="6" className="fill-ink" />
          <circle cx="54" cy="50" r="2" className="fill-white" />
          <circle cx="74" cy="50" r="2" className="fill-white" />
        </>
      ) : humor === 'triste' ? (
        <>
          <circle cx="50" cy="56" r="6" className="fill-ink" />
          <circle cx="70" cy="56" r="6" className="fill-ink" />
          {/* Sobrancelhas caídas */}
          <path d="M42 46 L56 49" className="stroke-ink" strokeWidth="3" strokeLinecap="round" />
          <path d="M78 46 L64 49" className="stroke-ink" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="50" cy="54" r="6" className="fill-ink" />
          <circle cx="70" cy="54" r="6" className="fill-ink" />
          <circle cx="52" cy="52" r="2" className="fill-white" />
          <circle cx="72" cy="52" r="2" className="fill-white" />
        </>
      )}

      {/* Boca */}
      {sorri ? (
        <path d="M52 66 Q60 74 68 66" className="stroke-ink" strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : humor === 'triste' ? (
        <path d="M52 72 Q60 66 68 72" className="stroke-ink" strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M54 68 L66 68" className="stroke-ink" strokeWidth="3" strokeLinecap="round" />
      )}

      {/* Bochechas */}
      {sorri && (
        <>
          <circle cx="42" cy="64" r="4.5" className="fill-secondary" opacity="0.45" />
          <circle cx="78" cy="64" r="4.5" className="fill-secondary" opacity="0.45" />
        </>
      )}
    </svg>
  );
}
