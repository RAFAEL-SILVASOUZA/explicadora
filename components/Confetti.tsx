'use client';

// Camada de confete para acertos. Decorativa: quem não quer movimento (prefers-reduced-motion)
// não vê nada, e quem usa leitor de tela não recebe anúncio — o texto do feedback já diz tudo.
// Os valores por pedaço são determinísticos (dependem só do índice) para não haver divergência
// de hidratação entre o HTML renderizado e o cliente.
const CORES = ['bg-primary', 'bg-secondary', 'bg-success', 'bg-star', 'bg-danger'];

export default function Confetti({ quantidade = 24 }: { quantidade?: number }) {
  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden" aria-hidden="true">
      {Array.from({ length: quantidade }, (_, i) => (
        <span
          key={i}
          className={`absolute block w-2 h-2 rounded-sm ${CORES[i % CORES.length]} animate-confetti-fall motion-reduce:hidden`}
          style={{
            left: `${(i * 37) % 100}%`,
            top: `${-10 - (i % 5) * 4}%`,
            animationDelay: `${(i % 10) * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}
