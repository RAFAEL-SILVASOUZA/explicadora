'use client';

export type HumorCoruja = 'neutro' | 'feliz' | 'pensando' | 'triste' | 'celebrando';

interface MascoteCorujaProps {
  humor?: HumorCoruja;
  className?: string;
}

/**
 * Corujinha "Professora Coruja", mascote do app.
 * Renderiza um SVG com expressões diferentes conforme o humor.
 */
export default function MascoteCoruja({ humor = 'neutro', className = '' }: MascoteCorujaProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label={`Corujinha ${humor}`}
    >
      {/* Asas */}
      <ellipse cx="22" cy="72" rx="14" ry="22" fill="#5B3FD4" />
      <ellipse cx="98" cy="72" rx="14" ry="22" fill="#5B3FD4" />

      {/* Corpo */}
      <ellipse cx="60" cy="74" rx="38" ry="40" fill="#7C5CFC" />

      {/* Barriga */}
      <ellipse cx="60" cy="86" rx="26" ry="26" fill="#EDE8FE" />

      {/* Pés */}
      <ellipse cx="48" cy="112" rx="8" ry="5" fill="#FF8A3D" />
      <ellipse cx="72" cy="112" rx="8" ry="5" fill="#FF8A3D" />

      {/* Orelhas / penachos */}
      <path d="M34 34 L28 14 L48 28 Z" fill="#5B3FD4" />
      <path d="M86 34 L92 14 L72 28 Z" fill="#5B3FD4" />

      {/* Olhos (brancos) */}
      <circle cx="46" cy="52" r="15" fill="#fff" />
      <circle cx="74" cy="52" r="15" fill="#fff" />

      {/* Pupila conforme o humor */}
      {humor === 'triste' ? (
        <>
          <circle cx="46" cy="56" r="6" fill="#2D2A3E" />
          <circle cx="74" cy="56" r="6" fill="#2D2A3E" />
          {/* Sobrancelhas tristes */}
          <path d="M34 40 L56 46" stroke="#2D2A3E" strokeWidth="3" strokeLinecap="round" />
          <path d="M86 40 L64 46" stroke="#2D2A3E" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : humor === 'pensando' ? (
        <>
          <circle cx="48" cy="50" r="6" fill="#2D2A3E" />
          <circle cx="76" cy="50" r="6" fill="#2D2A3E" />
        </>
      ) : humor === 'celebrando' ? (
        <>
          {/* Olhos em formato de alegria (arcs) */}
          <path d="M38 52 Q46 44 54 52" stroke="#2D2A3E" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M66 52 Q74 44 82 52" stroke="#2D2A3E" strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="46" cy="52" r="7" fill="#2D2A3E" />
          <circle cx="74" cy="52" r="7" fill="#2D2A3E" />
          <circle cx="49" cy="49" r="2.5" fill="#fff" />
          <circle cx="77" cy="49" r="2.5" fill="#fff" />
        </>
      )}

      {/* Bico */}
      <path d="M60 58 L52 66 L60 74 L68 66 Z" fill="#FF8A3D" />

      {/* Boca conforme o humor */}
      {humor === 'feliz' || humor === 'celebrando' ? (
        <path d="M52 78 Q60 86 68 78" stroke="#2D2A3E" strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : humor === 'triste' ? (
        <path d="M52 84 Q60 78 68 84" stroke="#2D2A3E" strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M54 80 L66 80" stroke="#2D2A3E" strokeWidth="3" strokeLinecap="round" />
      )}

      {/* Bochechas */}
      {(humor === 'feliz' || humor === 'celebrando') && (
        <>
          <circle cx="34" cy="64" r="5" fill="#FF8A3D" opacity="0.5" />
          <circle cx="86" cy="64" r="5" fill="#FF8A3D" opacity="0.5" />
        </>
      )}
    </svg>
  );
}
