import { describe, expect, it } from 'vitest';
import { DURACAO_MAXIMA_MS, DURACAO_MINIMA_MS, duracaoDoPasso, progressoDoPasso } from '@/lib/deveres/timeline';

describe('duracaoDoPasso', () => {
  it('usa a duração real do áudio quando existe', () => {
    expect(duracaoDoPasso({ narracao: 'qualquer coisa', duracao_ms: 3400 })).toBe(3400);
  });

  it('estima por palavras quando o áudio está ausente', () => {
    // 13 palavras a 2,6 palavras/s ≈ 5000 ms
    const narracao = 'a b c d e f g h i j k l m';
    expect(duracaoDoPasso({ narracao, duracao_ms: null })).toBe(5000);
  });

  it('nunca devolve menos que o mínimo', () => {
    expect(duracaoDoPasso({ narracao: 'oi', duracao_ms: null })).toBe(DURACAO_MINIMA_MS);
    expect(duracaoDoPasso({ narracao: 'oi', duracao_ms: 10 })).toBe(DURACAO_MINIMA_MS);
  });

  it('nunca devolve mais que o máximo', () => {
    expect(duracaoDoPasso({ narracao: 'x'.repeat(500), duracao_ms: 999_999 })).toBe(DURACAO_MAXIMA_MS);
  });
});

describe('progressoDoPasso', () => {
  it('0 no início e 1 no fim', () => {
    expect(progressoDoPasso(0, 3000)).toBe(0);
    expect(progressoDoPasso(3000, 3000)).toBe(1);
  });

  it('meio do caminho', () => {
    expect(progressoDoPasso(1500, 3000)).toBeCloseTo(0.5);
  });

  it('clampa antes de 0 e depois do fim', () => {
    expect(progressoDoPasso(-500, 3000)).toBe(0);
    expect(progressoDoPasso(9000, 3000)).toBe(1);
  });

  it('duração zero devolve 1 (passo sem áudio não trava a animação)', () => {
    expect(progressoDoPasso(0, 0)).toBe(1);
  });
});
