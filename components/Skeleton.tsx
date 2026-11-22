// Silhuetas pulsantes para carregamento inicial de páginas e grades de cards.
// Mantêm o layout no lugar (sem "pulo" quando o conteúdo chega).

export function SkeletonBloco({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-2xl bg-ink/10 motion-reduce:animate-none ${className}`} />;
}

export function SkeletonTexto({ linhas = 3, className = '' }: { linhas?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={`space-y-2 ${className}`}>
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="animate-pulse h-4 rounded-full bg-ink/10 motion-reduce:animate-none" style={{ width: `${92 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`card ${className}`} role="status" aria-label="Carregando…">
      <SkeletonBloco className="w-12 h-12 rounded-full mb-4" />
      <SkeletonBloco className="h-6 w-2/3 mb-3" />
      <SkeletonTexto linhas={3} />
    </div>
  );
}

/** Grade de silhuetas com o mesmo comportamento responsivo das grades do app. */
export function SkeletonGrade({ quantidade = 6, className = '' }: { quantidade?: number; className?: string }) {
  return (
    <>
      <span className="sr-only" role="status">
        Carregando…
      </span>
      <div aria-hidden="true" className={`grid gap-4 sm:gap-6 grid-cols-1 ${className}`}>
        {Array.from({ length: quantidade }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </>
  );
}
