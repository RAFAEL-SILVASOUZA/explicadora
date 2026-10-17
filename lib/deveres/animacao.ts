import type { Cena, Primitivo } from './cena';

export interface PrimitivoAnimada {
  primitivo: Primitivo;
  progresso: number;
}

// Cada primitiva tem sua animação contida nos JANELA_ANIMACAO finais do passo,
// então duas primitivas com aparece_em próximos não se atropelam.
const JANELA_ANIMACAO = 0.4;

// Função pura: o loop de requestAnimationFrame só a chama e pinta. Isso torna
// "repetir passo" determinístico e o motor testável sem canvas.
export function estadoDoPasso(cena: Cena, progresso: number, movimentoReduzido: boolean): PrimitivoAnimada[] {
  const visiveis: PrimitivoAnimada[] = [];
  for (const primitivo of cena.primitivos) {
    const entrou = progresso >= primitivo.aparece_em;
    if (!entrou) continue;
    if (movimentoReduzido) {
      visiveis.push({ primitivo, progresso: 1 });
      continue;
    }
    const restante = 1 - primitivo.aparece_em;
    const local = restante <= 0
      ? 1
      : (progresso - primitivo.aparece_em) / Math.min(JANELA_ANIMACAO, restante);
    visiveis.push({ primitivo, progresso: Math.min(1, Math.max(0, local)) });
  }
  return visiveis;
}
