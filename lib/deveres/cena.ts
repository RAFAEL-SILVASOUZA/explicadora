import { z } from 'zod';

// Limites de segurança: o contexto do modelo de visão é apertado e o canvas da
// criança não pode receber uma cena com centenas de formas.
export const MAX_PASSOS = 8;
export const MAX_PRIMITIVOS_POR_CENA = 24;

// Tetos de contagem interna das primitivas. O clamp de coordenadas não protege
// loops: o renderizador da Task 12 itera `p.itens` por frame dentro do
// requestAnimationFrame, então um `itens: 100000` vindo do modelo congelaria o
// navegador da criança. Os tetos ficam na sanitização (não no schema) para que
// uma cena fora do limite seja corrigida em vez de descartada.
export const MAX_ITENS_BLOCOS = 100;
export const MAX_COLUNAS_BLOCOS = 20;
export const MAX_MARCAS_RETA = 24;
export const MAX_PARTES_BARRA = 12;
export const MAX_ITENS_PRATO = 12;

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

// Contagens internas escapam do clamp de coordenadas e viram loop longo no
// renderizador. Limitar aqui (e não no schema) preserva a cena: um `itens`
// exagerado continua ensinando, só que com o número de formas que o canvas
// aguenta por frame. `slice`/valores novos mantêm a entrada intacta.
function limitarContagens(p: Record<string, unknown>): Record<string, unknown> {
  switch (p.kind) {
    case 'blocos': {
      const saida = { ...p };
      if (typeof saida.colunas === 'number') {
        saida.colunas = Math.min(MAX_COLUNAS_BLOCOS, Math.max(1, Math.trunc(saida.colunas)));
      }
      if (typeof saida.itens === 'number') {
        saida.itens = Math.min(MAX_ITENS_BLOCOS, Math.max(1, Math.trunc(saida.itens)));
      }
      return saida;
    }
    case 'reta_numerica': {
      if (Array.isArray(p.marcas) && p.marcas.length > MAX_MARCAS_RETA) {
        return { ...p, marcas: p.marcas.slice(0, MAX_MARCAS_RETA) };
      }
      return p;
    }
    case 'barra_modelo': {
      if (Array.isArray(p.partes) && p.partes.length > MAX_PARTES_BARRA) {
        return { ...p, partes: p.partes.slice(0, MAX_PARTES_BARRA) };
      }
      return p;
    }
    case 'balanca': {
      const saida = { ...p };
      let mudou = false;
      for (const chave of ['prato_esquerdo', 'prato_direito'] as const) {
        const prato = saida[chave];
        if (Array.isArray(prato) && prato.length > MAX_ITENS_PRATO) {
          saida[chave] = prato.slice(0, MAX_ITENS_PRATO);
          mudou = true;
        }
      }
      return mudou ? saida : p;
    }
    default:
      return p;
  }
}

export function sanitizarCena(cena: Cena): Cena {
  const primitivos = cena.primitivos
    .map((p) => limitarContagens(clamparCoordenadas(p as Record<string, unknown>)))
    .filter(temTamanhoVisivel)
    .slice(0, MAX_PRIMITIVOS_POR_CENA);
  return { ...cena, primitivos } as Cena;
}

export function sanitizarStoryboard(sb: Storyboard): Storyboard {
  // A spec fixa 3 a 8 passos: fora disso clampa para os primeiros 8 e loga, para
  // que um storyboard truncado seja visível no log do servidor e não só na tela.
  if (sb.passos.length > MAX_PASSOS) {
    console.warn(
      `[deveres] storyboard com ${sb.passos.length} passos: truncado para ${MAX_PASSOS}.`,
    );
  }
  return {
    ...sb,
    passos: sb.passos
      .slice(0, MAX_PASSOS)
      .map((p) => ({ ...p, cena: sanitizarCena(p.cena) })),
  };
}
