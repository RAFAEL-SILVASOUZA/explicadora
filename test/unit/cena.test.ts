import { describe, expect, it } from 'vitest';
import {
  MAX_PASSOS, MAX_PRIMITIVOS_POR_CENA, StoryboardSchema,
  sanitizarStoryboard, sanitizarCena, type Storyboard,
} from '@/lib/deveres/cena';

function cenaCom(...primitivos: unknown[]) {
  return { fundo: '#FDF6EC', primitivos } as never;
}

function passo(n: number) {
  return {
    titulo: `Passo ${n}`,
    narracao: 'Frase de narração.',
    cena: cenaCom({ kind: 'texto', x: 0.5, y: 0.5, valor: 'oi', tamanho: 0.1 }),
  };
}

function storyboard(passos: unknown[]): Storyboard {
  return {
    titulo: 'Soma com barras',
    disciplina: 'Matemática',
    resumo_para_pais: 'A Lia explica o método das barras.',
    passos,
  } as Storyboard;
}

describe('StoryboardSchema', () => {
  it('aceita um storyboard mínimo', () => {
    const r = StoryboardSchema.safeParse(storyboard([passo(1)]));
    expect(r.success).toBe(true);
  });

  it('rejeita kind desconhecido', () => {
    const r = StoryboardSchema.safeParse(storyboard([
      { titulo: 'x', narracao: 'y', cena: cenaCom({ kind: 'grafico_3d', x: 0.5, y: 0.5 }) },
    ]));
    expect(r.success).toBe(false);
  });

  it('default fundo quando ausente', () => {
    const r = StoryboardSchema.safeParse(storyboard([
      { titulo: 'x', narracao: 'y', cena: { primitivos: [] } },
    ]));
    expect(r.success && r.data.passos[0].cena.fundo).toBe('#FDF6EC');
  });
});

describe('sanitizarStoryboard', () => {
  it('trunca para os MAX_PASSOS primeiros passos', () => {
    const muitos = Array.from({ length: MAX_PASSOS + 3 }, (_, i) => passo(i + 1));
    expect(sanitizarStoryboard(storyboard(muitos)).passos).toHaveLength(MAX_PASSOS);
  });

  it('não corta quando o número de passos está no limite', () => {
    const exatos = Array.from({ length: MAX_PASSOS }, (_, i) => passo(i + 1));
    expect(sanitizarStoryboard(storyboard(exatos)).passos).toHaveLength(MAX_PASSOS);
  });
});

describe('sanitizarCena', () => {
  it('clampa coordenada acima de 1', () => {
    const cena = sanitizarCena(cenaCom({ kind: 'circulo', x: 1.7, y: -0.4, r: 0.2, cor: '#7C5CFC' }));
    expect(cena.primitivos[0]).toMatchObject({ x: 1, y: 0 });
  });

  it('clampa aparece_em para dentro de 0..1', () => {
    const cena = sanitizarCena(cenaCom({ kind: 'circulo', x: 0.5, y: 0.5, r: 0.1, cor: '#000', aparece_em: 2.5 }));
    expect(cena.primitivos[0]).toMatchObject({ aparece_em: 1 });
  });

  it('trunca primitivos acima do limite', () => {
    const muitos = Array.from({ length: MAX_PRIMITIVOS_POR_CENA + 5 }, () =>
      ({ kind: 'circulo', x: 0.5, y: 0.5, r: 0.1, cor: '#000' }));
    expect(sanitizarCena(cenaCom(...muitos)).primitivos).toHaveLength(MAX_PRIMITIVOS_POR_CENA);
  });

  it('descarta primitiva de tamanho não positivo', () => {
    const cena = sanitizarCena(cenaCom({ kind: 'circulo', x: 0.5, y: 0.5, r: 0, cor: '#000' }));
    expect(cena.primitivos).toHaveLength(0);
  });
});
