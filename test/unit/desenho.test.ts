import { describe, expect, it } from 'vitest';
import { px, pontoDoTraco } from '@/lib/deveres/desenho';

describe('px', () => {
  it('converte coordenada normalizada em pixel', () => {
    expect(px(0.5, 800)).toBe(400);
    expect(px(0, 800)).toBe(0);
    expect(px(1, 600)).toBe(600);
  });

  it('clampa valor fora de 0..1 (defesa em profundidade)', () => {
    expect(px(1.4, 100)).toBe(100);
    expect(px(-0.2, 100)).toBe(0);
  });
});

describe('pontoDoTraco', () => {
  it('no progresso 0 o traço não saiu', () => {
    expect(pontoDoTraco(10, 100, 0)).toBe(10);
  });

  it('no progresso 1 o traço chegou ao fim', () => {
    expect(pontoDoTraco(10, 100, 1)).toBe(100);
  });

  it('no meio do traço', () => {
    expect(pontoDoTraco(0, 100, 0.5)).toBe(50);
  });
});
