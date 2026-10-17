// Fallback quando o áudio não foi sintetizado (Piper ausente no dev). 2,6
// palavras/s é fala pausada de explicação para criança.
export const PALAVRAS_POR_SEGUNDO = 2.6;
export const DURACAO_MINIMA_MS = 1200;
export const DURACAO_MAXIMA_MS = 45_000;

function clamp(v: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, v));
}

export function duracaoDoPasso(passo: { narracao: string; duracao_ms: number | null }): number {
  const estimada = Math.round(
    (passo.narracao.trim().split(/\s+/).filter(Boolean).length / PALAVRAS_POR_SEGUNDO) * 1000,
  );
  return clamp(passo.duracao_ms ?? estimada, DURACAO_MINIMA_MS, DURACAO_MAXIMA_MS);
}

export function progressoDoPasso(decorridoMs: number, duracaoMs: number): number {
  if (duracaoMs <= 0) return 1;
  return clamp(decorridoMs / duracaoMs, 0, 1);
}
