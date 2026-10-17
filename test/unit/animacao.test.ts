import { describe, expect, it } from 'vitest';
import { estadoDoPasso } from '@/lib/deveres/animacao';
import type { Cena } from '@/lib/deveres/cena';

function cena(...primitivos: unknown[]): Cena {
  return { fundo: '#FDF6EC', primitivos } as Cena;
}

const textoEm0 = { kind: 'texto', x: 0.1, y: 0.2, valor: 'a', tamanho: 0.1, aparece_em: 0, animacao: 'fade' };
const setaEm50 = { kind: 'seta', x: 0.1, y: 0.2, x2: 0.6, y2: 0.2, cor: '#7C5CFC', aparece_em: 0.5, animacao: 'desenhar' };

describe('estadoDoPasso', () => {
  it('esconde primitiva que ainda não entrou', () => {
    const visiveis = estadoDoPasso(cena(setaEm50), 0.2, false);
    expect(visiveis).toHaveLength(0);
  });

  it('mostra primitiva com aparece_em 0 desde o início', () => {
    const visiveis = estadoDoPasso(cena(textoEm0), 0, false);
    expect(visiveis).toHaveLength(1);
  });

  it('progresso individual progride linearmente nos 40% finais do passo', () => {
    const visiveis = estadoDoPasso(cena(setaEm50), 0.7, false);
    expect(visiveis[0].progresso).toBeCloseTo(0.5);
  });

  it('progresso individual chega a 1 no fim do passo', () => {
    const visiveis = estadoDoPasso(cena(setaEm50), 1, false);
    expect(visiveis[0].progresso).toBe(1);
  });

  it('mantém a ordem das primitivas', () => {
    const visiveis = estadoDoPasso(cena(textoEm0, setaEm50), 1, false);
    expect(visiveis.map(v => v.primitivo.kind)).toEqual(['texto', 'seta']);
  });

  it('com movimento reduzido tudo entra pronto', () => {
    // O brief passava progresso 0 aqui, o que contradiz o teste seguinte: com
    // movimento reduzido a primitiva continua a entrar no seu aparece_em, só que
    // sem animação. Em 0.7 a seta (aparece_em 0.5) estaria com progresso 0.5
    // sem reduzir; com reduzir vai a 1.
    const visiveis = estadoDoPasso(cena(textoEm0, setaEm50), 0.7, true);
    expect(visiveis).toHaveLength(2);
    expect(visiveis.every(v => v.progresso === 1)).toBe(true);
  });

  it('com movimento reduzido ainda esconde o que não entrou', () => {
    // "entra" = o passo já chegou naquele ponto; progresso 1 só para o que entrou.
    const visiveis = estadoDoPasso(cena(setaEm50), 0.4, true);
    expect(visiveis).toHaveLength(0);
  });
});
