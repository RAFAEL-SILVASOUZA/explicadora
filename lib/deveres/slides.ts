import { z } from 'zod';

// O dever é uma sequência curta de slides: título + explicação de poucas frases.
// O limite existe porque o aluno quer a explicação direto, não um texto corrido.
export const MAX_SLIDES = 8;
export const MAX_TITULO = 80;
export const MAX_EXPLICACAO = 600;

export const SlideSchema = z.object({
  titulo: z.string(),
  explicacao: z.string(),
});

export const PlanoSchema = z.object({
  titulo: z.string(),
  disciplina: z.string(),
  resumo_para_pais: z.string(),
  slides: z.array(SlideSchema),
});

export type Slide = z.infer<typeof SlideSchema>;
export type Plano = z.infer<typeof PlanoSchema>;

function limitar(texto: string, max: number): string {
  const limpo = texto.trim();
  return limpo.length > max ? limpo.slice(0, max).trimEnd() : limpo;
}

// O modelo local às vezes devolve títulos gigantes ou parágrafos de página inteira.
// Limitar (em vez de rejeitar) preserva o dever que o pai pagou para criar.
export function sanitizarPlano(plano: Plano): Plano {
  if (plano.slides.length > MAX_SLIDES) {
    console.warn(`[deveres] plano com ${plano.slides.length} slides: truncado para ${MAX_SLIDES}.`);
  }
  return {
    ...plano,
    titulo: limitar(plano.titulo, MAX_TITULO),
    disciplina: limitar(plano.disciplina, MAX_TITULO),
    resumo_para_pais: limitar(plano.resumo_para_pais, MAX_EXPLICACAO),
    slides: plano.slides.slice(0, MAX_SLIDES).map((s) => ({
      titulo: limitar(s.titulo, MAX_TITULO),
      explicacao: limitar(s.explicacao, MAX_EXPLICACAO),
    })),
  };
}
