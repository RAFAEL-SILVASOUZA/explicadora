interface Props {
  // Texto anunciado (e opcionalmente visível) enquanto a espera dura.
  label?: string;
  // Dentro de botão o texto fica só para leitores de tela; o ícone girando basta para a vista.
  visivel?: boolean;
  tamanho?: 'sm' | 'md' | 'lg';
  // Cor do anel quando o contexto não é o roxo do app (ex.: lixeira vermelha).
  corDoAnel?: string;
  className?: string;
}

const MEDIDAS = { sm: 'w-5 h-5 border-2', md: 'w-8 h-8 border-[3px]', lg: 'w-12 h-12 border-4' } as const;

/** Spinner padrão de espera do app. Use em TODO botão/área que deixa a pessoa esperando. */
export default function Spinner({ label = 'Carregando…', visivel = false, tamanho = 'md', corDoAnel = 'border-primary', className = '' }: Props) {
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden="true"
        className={`${MEDIDAS[tamanho]} rounded-full ${corDoAnel} border-t-transparent animate-spin motion-reduce:animate-none motion-reduce:border-t-current`}
      />
      <span className={visivel ? 'text-ink/70 font-semibold' : 'sr-only'}>{label}</span>
    </span>
  );
}
