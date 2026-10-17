import { describe, expect, it, vi } from 'vitest';
import {
  MAX_PASSOS, MAX_PRIMITIVOS_POR_CENA, MAX_ITENS_BLOCOS, MAX_COLUNAS_BLOCOS,
  MAX_MARCAS_RETA, MAX_PARTES_BARRA, MAX_ITENS_PRATO,
  StoryboardSchema, CenaSchema,
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
    const exatos = Array.from({ length: MAX_PASSOS }, (_, i) =>
      ({
        titulo: `Passo ${i + 1}`,
        narracao: 'Frase de narração.',
        cena: cenaCom({ kind: 'circulo', x: 1.4, y: 0.5, r: 0.1, cor: '#000' }),
      }));
    const sb = sanitizarStoryboard(storyboard(exatos));
    expect(sb.passos).toHaveLength(MAX_PASSOS);
    // A sanitização roda em cada passo mesmo sem corte: sem o map, o clamp abaixo falha.
    expect(sb.passos[0].cena.primitivos[0]).toMatchObject({ x: 1 });
  });

  it('loga quando trunca passos, com a contagem de entrada e saída', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const muitos = Array.from({ length: MAX_PASSOS + 3 }, (_, i) => passo(i + 1));
      const sb = sanitizarStoryboard(storyboard(muitos));
      expect(sb.passos).toHaveLength(MAX_PASSOS);
      expect(warn).toHaveBeenCalledTimes(1);
      const mensagem = String(warn.mock.calls[0][0]);
      expect(mensagem).toContain(`[deveres]`);
      expect(mensagem).toContain(String(muitos.length));
      expect(mensagem).toContain(String(MAX_PASSOS));
    } finally {
      warn.mockRestore();
    }
  });

  it('não loga quando não há truncamento de passos', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      sanitizarStoryboard(storyboard([passo(1)]));
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
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

  it('descarta primitiva com w não positivo', () => {
    const cena = sanitizarCena(cenaCom({ kind: 'retangulo', x: 0.5, y: 0.5, w: 0, h: 0.2, cor: '#000' }));
    expect(cena.primitivos).toHaveLength(0);
  });

  it('descarta primitiva com h não positivo', () => {
    const cena = sanitizarCena(cenaCom({ kind: 'retangulo', x: 0.5, y: 0.5, w: 0.2, h: -1, cor: '#000' }));
    expect(cena.primitivos).toHaveLength(0);
  });

  it('descarta primitiva com tamanho não positivo', () => {
    const cena = sanitizarCena(cenaCom({ kind: 'texto', x: 0.5, y: 0.5, valor: 'oi', tamanho: 0 }));
    expect(cena.primitivos).toHaveLength(0);
  });

  it('mantém a primitiva quando todos os tamanhos são positivos', () => {
    const cena = sanitizarCena(cenaCom({ kind: 'retangulo', x: 0.5, y: 0.5, w: 0.2, h: 0.2, cor: '#000' }));
    expect(cena.primitivos).toHaveLength(1);
  });

  it('clampa blocos.itens e blocos.colunas para os tetos', () => {
    const cena = sanitizarCena(cenaCom({
      kind: 'blocos', x: 0.1, y: 0.1, colunas: 999, itens: MAX_ITENS_BLOCOS + 500,
    }));
    expect(cena.primitivos[0]).toMatchObject({ itens: MAX_ITENS_BLOCOS, colunas: MAX_COLUNAS_BLOCOS });
  });

  it('nunca deixa blocos.colunas abaixo de 1', () => {
    // O schema exige colunas >= 1; a sanitização é defensiva e re-clampa na descida.
    const cena = sanitizarCena(cenaCom({ kind: 'blocos', x: 0.1, y: 0.1, colunas: 0, itens: 4 }));
    expect(cena.primitivos[0]).toMatchObject({ colunas: 1, itens: 4 });
  });

  it('trunca reta_numerica.marcas para o teto', () => {
    const marcas = Array.from({ length: MAX_MARCAS_RETA + 10 }, (_, i) => i);
    const cena = sanitizarCena(cenaCom({
      kind: 'reta_numerica', x: 0.1, y: 0.5, w: 0.8, minimo: 0, maximo: 20, marcas,
    }));
    expect(cena.primitivos[0]).toMatchObject({ marcas: marcas.slice(0, MAX_MARCAS_RETA) });
  });

  it('trunca barra_modelo.partes para o teto', () => {
    const partes = Array.from({ length: MAX_PARTES_BARRA + 6 }, (_, i) => ({ valor: i + 1 }));
    const cena = sanitizarCena(cenaCom({ kind: 'barra_modelo', x: 0.1, y: 0.2, w: 0.8, h: 0.3, partes }));
    const primitiva = cena.primitivos[0] as { partes: unknown[] };
    expect(primitiva.partes).toHaveLength(MAX_PARTES_BARRA);
    expect(primitiva.partes[0]).toEqual({ valor: 1 });
  });

  it('trunca os pratos da balanca para o teto', () => {
    const itens = Array.from({ length: MAX_ITENS_PRATO + 6 }, (_, i) => `item ${i + 1}`);
    const cena = sanitizarCena(cenaCom({
      kind: 'balanca', x: 0.1, y: 0.2, w: 0.8, prato_esquerdo: itens, prato_direito: itens,
    }));
    const primitiva = cena.primitivos[0] as { prato_esquerdo: unknown[]; prato_direito: unknown[] };
    expect(primitiva.prato_esquerdo).toHaveLength(MAX_ITENS_PRATO);
    expect(primitiva.prato_direito).toHaveLength(MAX_ITENS_PRATO);
  });

  it('não muta a cena de entrada ao aplicar os tetos', () => {
    const partes = Array.from({ length: MAX_PARTES_BARRA + 6 }, (_, i) => ({ valor: i + 1 }));
    const entrada = cenaCom({ kind: 'barra_modelo', x: 0.1, y: 0.2, w: 0.8, h: 0.3, partes }) as never;
    sanitizarCena(entrada);
    expect((entrada as unknown as { primitivos: Array<{ partes: unknown[] }> }).primitivos[0].partes)
      .toHaveLength(MAX_PARTES_BARRA + 6);
  });
});

describe('parse seguido de sanitizar', () => {
  it('aplica os defaults do schema antes da sanitização', () => {
    const cena = sanitizarCena(CenaSchema.parse({
      primitivos: [
        { kind: 'circulo', x: 1.7, y: 0.5, r: 0.1 },
        { kind: 'retangulo', x: 0.2, y: 0.2, w: 0.3, h: 0.2 },
        { kind: 'texto', x: 0.5, y: 0.5, valor: 'oi', tamanho: 0.1 },
      ],
    }));
    expect(cena.fundo).toBe('#FDF6EC');
    expect(cena.primitivos).toHaveLength(3);
    for (const p of cena.primitivos) {
      expect(p).toHaveProperty('aparece_em', 0);
      expect(p).toHaveProperty('animacao', 'fade');
    }
    expect(cena.primitivos[0]).toMatchObject({ x: 1, cor: '#7C5CFC' });
    expect(cena.primitivos[1]).toMatchObject({ cor: '#7C5CFC', raio: 0 });
    expect(cena.primitivos[2]).toMatchObject({ cor: '#2D2A3E', alinhamento: 'esquerda' });
  });

  it('storyboard parseado e sanitizado mantém defaults e teto de passos', () => {
    const passos = Array.from({ length: MAX_PASSOS + 2 }, (_, i) => ({
      titulo: `Passo ${i + 1}`,
      narracao: 'Frase de narração.',
      cena: { primitivos: [{ kind: 'circulo', x: 0.5, y: 0.5, r: 0.1 }] },
    }));
    const parsed = StoryboardSchema.parse({
      titulo: 'Soma com barras',
      disciplina: 'Matemática',
      resumo_para_pais: 'A Lia explica o método das barras.',
      passos,
    });
    const sb = sanitizarStoryboard(parsed);
    expect(sb.passos).toHaveLength(MAX_PASSOS);
    expect(sb.passos[0].cena.fundo).toBe('#FDF6EC');
    expect(sb.passos[0].cena.primitivos[0]).toMatchObject({ aparece_em: 0, animacao: 'fade', cor: '#7C5CFC' });
  });
});
