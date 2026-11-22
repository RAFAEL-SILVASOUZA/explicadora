'use client';

export type Humor = 'neutro' | 'feliz' | 'pensando' | 'triste' | 'celebrando';

interface MascoteProps {
  humor?: Humor;
  className?: string;
  // Decorativa: o ícone é enfeite ao lado de um texto que já diz o que é. Sem role/label
  // ele não entra na árvore de acessibilidade, senão o nome do heading fica duplicado.
  decorative?: boolean;
}

/**
 * Ícone da marca EXPLICADORA (o robô IA, viewBox `55 60 380 400`).
 *
 * A personagem "Lia" foi removida no rebrand: o app agora usa apenas o ícone.
 * O prop `humor` é aceito e ignorado para não quebrar os chamadores antigos,
 * mas não muda mais nada visualmente.
 */
export default function Mascote({
  className = '', decorative = false,
}: MascoteProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- ícone da marca (SVG local)
    <img
      src="/logo-icon.svg"
      alt={decorative ? '' : 'Estudo Divertido'}
      aria-hidden={decorative || undefined}
      className={className}
    />
  );
}
