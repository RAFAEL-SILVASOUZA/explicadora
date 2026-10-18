import { describe, expect, it } from 'vitest';
import {
  FONTE_MINIMA_EMOJI,
  FONTE_MINIMA_ROTULO,
  FONTE_MINIMA_TEXTO,
  px,
  pontoDoTraco,
  tamanhoDeFonte,
} from '@/lib/deveres/desenho';

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

describe('tamanhoDeFonte', () => {
  it('num canvas grande usa o tamanho normalizado', () => {
    expect(tamanhoDeFonte(0.04, 600, FONTE_MINIMA_TEXTO)).toBe(24);
  });

  it('num canvas pequeno aplica o piso (canvas de celular: 0,035 de 270px = 9px)', () => {
    expect(tamanhoDeFonte(0.035, 270, FONTE_MINIMA_TEXTO)).toBe(FONTE_MINIMA_TEXTO);
  });

  it('o piso de rótulo é menor que o de texto corrido', () => {
    expect(FONTE_MINIMA_ROTULO).toBeLessThan(FONTE_MINIMA_TEXTO);
    expect(FONTE_MINIMA_EMOJI).toBeGreaterThan(FONTE_MINIMA_TEXTO);
  });

  it('coordenada inválida não gera fonte negativa', () => {
    expect(tamanhoDeFonte(-1, 600, FONTE_MINIMA_ROTULO)).toBe(FONTE_MINIMA_ROTULO);
  });
});
