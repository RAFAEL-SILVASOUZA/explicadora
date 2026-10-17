import { z } from 'zod';

// Limites de segurança: o contexto do modelo de visão é apertado e o canvas da
// criança não pode receber uma cena com centenas de formas.
export const MAX_PASSOS = 8;
export const MAX_PRIMITIVOS_POR_CENA = 24;

// Coordenadas são normalizadas em 0..1 nos dois eixos: o renderizador multiplica
// pelo tamanho efetivo do canvas, então o modelo não precisa conhecer a tela.
const coord = z.number();
const cor = z.string().regex(/^#[0-9a-fA-F]{3,8}$/).default('#7C5CFC');

const base = {
  x: coord,
  y: coord,
  aparece_em: z.number().default(0),
  animacao: z.enum(['fade', 'desenhar', 'crescer', 'pular']).default('fade'),
};

const PrimitivoSchema = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('retangulo'), w: coord, h: coord, cor, raio: z.number().default(0) }),
  z.object({ ...base, kind: z.literal('circulo'), r: coord, cor }),
  z.object({ ...base, kind: z.literal('linha'), x2: coord, y2: coord, cor, espessura: z.number().default(0.004) }),
  z.object({ ...base, kind: z.literal('seta'), x2: coord, y2: coord, cor, espessura: z.number().default(0.006) }),
  z.object({
    ...base, kind: z.literal('texto'), valor: z.string(), tamanho: coord,
    cor: cor.default('#2D2A3E'), alinhamento: z.enum(['esquerda', 'centro', 'direita']).default('esquerda'),
  }),
  z.object({ ...base, kind: z.literal('emoji'), valor: z.string(), tamanho: coord }),
  z.object({
    ...base, kind: z.literal('reta_numerica'), w: coord,
    minimo: z.number(), maximo: z.number(), marcas: z.array(z.number()).default([]),
    destaque: z.number().optional(), rotulo: z.string().default(''), cor,
  }),
  z.object({
    ...base, kind: z.literal('barra_modelo'), w: coord, h: coord,
    partes: z.array(z.object({ valor: z.number(), rotulo: z.string().default(''), cor: cor.optional() })).default([]),
  }),
  z.object({
    ...base, kind: z.literal('balanca'), w: coord,
    prato_esquerdo: z.array(z.string()).default([]),
    prato_direito: z.array(z.string()).default([]),
    inclinacao: z.number().default(0), cor,
  }),
  z.object({
    ...base, kind: z.literal('blocos'), colunas: z.number().int().min(1), itens: z.number().int().min(1),
    tipo: z.enum(['quadrado', 'moeda']).default('quadrado'), cor,
  }),
  z.object({ ...base, kind: z.literal('destaque'), w: coord, h: coord }),
]);

export const CenaSchema = z.object({
  fundo: cor.default('#FDF6EC'),
  primitivos: z.array(PrimitivoSchema),
});

export const PassoSchema = z.object({
  titulo: z.string(),
  narracao: z.string(),
  cena: CenaSchema,
});

export const StoryboardSchema = z.object({
  titulo: z.string(),
  disciplina: z.string(),
  resumo_para_pais: z.string(),
  passos: z.array(PassoSchema),
});

export type Primitivo = z.infer<typeof PrimitivoSchema>;
export type Cena = z.infer<typeof CenaSchema>;
export type Passo = z.infer<typeof PassoSchema>;
export type Storyboard = z.infer<typeof StoryboardSchema>;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// O modelo erra coordenadas com frequência (1200 em vez de 0.8, -0.2). Clampar
// preserva a intenção em vez de descartar a cena inteira.
function clamparCoordenadas(p: Record<string, unknown>): Record<string, unknown> {
  const saida = { ...p };
  for (const chave of ['x', 'y', 'x2', 'y2', 'aparece_em']) {
    if (typeof saida[chave] === 'number') saida[chave] = clamp01(saida[chave] as number);
  }
  return saida;
}

// Forma sem área visível é ruído: um círculo de raio 0 ou uma barra de altura 0
// ocupam o orçamento de primitivos sem ensinar nada.
function temTamanhoVisivel(p: Record<string, unknown>): boolean {
  for (const chave of ['r', 'w', 'h', 'tamanho']) {
    if (chave in p && typeof p[chave] === 'number' && (p[chave] as number) <= 0) return false;
  }
  return true;
}

export function sanitizarCena(cena: Cena): Cena {
  const primitivos = cena.primitivos
    .map((p) => clamparCoordenadas(p as Record<string, unknown>))
    .filter(temTamanhoVisivel)
    .slice(0, MAX_PRIMITIVOS_POR_CENA);
  return { ...cena, primitivos } as Cena;
}

export function sanitizarStoryboard(sb: Storyboard): Storyboard {
  return {
    ...sb,
    passos: sb.passos
      .slice(0, MAX_PASSOS)
      .map((p) => ({ ...p, cena: sanitizarCena(p.cena) })),
  };
}
