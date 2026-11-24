import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

// Um cartão do placar: um número, uma pergunta simples, um caminho. A cor do chip vem
// de classes tailwind prontas (light + ink), nunca de cor crua inline — a tela e o
// design system concordam em um só lugar.
// O link é o cartão inteiro (mesma decisão do RevisaoGrid): a métrica é a porta para
// a área dona do número.
interface StatCardProps {
  href: string;
  icon: LucideIcon;
  iconClasse: string;
  numero: string;
  rotulo: string;
  caption: string;
  /** Chip discreto com a evolução da última semana, ex.: "2 esta semana". */
  destaque?: string | null;
  /** Barra fina de leitura do dever (0–100); some quando não há slides. */
  progresso?: number | null;
}

export default function StatCard({
  href, icon: Icon, iconClasse, numero, rotulo, caption, destaque = null, progresso = null,
}: StatCardProps) {
  return (
    <Link
      href={href}
      className="card block min-w-0 hover:shadow-card-hover hover:-translate-y-0.5
                 transition-[box-shadow,transform] duration-200 focus-visible:outline-offset-2"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span
          aria-hidden="true"
          className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl ${iconClasse}`}
        >
          <Icon size={24} />
        </span>
        {destaque && (
          // O chip é informação secundária (a evolução), não o fato principal: peso menor.
          <span className="badge bg-primary-light text-primary-dark shrink-0">{destaque}</span>
        )}
      </div>
      <p className="text-4xl font-extrabold text-ink leading-none mb-1">{numero}</p>
      <p className="text-base font-bold text-ink/80 leading-snug">{rotulo}</p>
      {progresso != null && (
        // Decorativa: o caption diz os valores; a barra só mostra a forma.
        <div aria-hidden="true" className="h-2 rounded-full bg-ink/10 overflow-hidden mt-3">
          <div className="h-full bg-primary rounded-full transition-[width] duration-500" style={{ width: `${progresso}%` }} />
        </div>
      )}
      <p className="text-sm text-ink/60 mt-2 leading-snug">{caption}</p>
    </Link>
  );
}
