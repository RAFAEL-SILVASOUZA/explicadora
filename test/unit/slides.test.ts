import { describe, expect, it, vi } from 'vitest';
import { MAX_EXPLICACAO, MAX_SLIDES, MAX_TITULO, sanitizarPlano } from '../../lib/deveres/slides';
import type { Plano } from '../../lib/deveres/slides';

function planoCom(n: number): Plano {
  return {
    titulo: 'Soma',
    disciplina: 'Matemática',
    resumo_para_pais: 'resumo',
    slides: Array.from({ length: n }, (_, i) => ({ titulo: `S${i + 1}`, explicacao: 'explica' })),
  };
}

describe('sanitizarPlano', () => {
  it('clampa para os primeiros MAX_SLIDES e loga', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = sanitizarPlano(planoCom(MAX_SLIDES + 4));
    expect(r.slides).toHaveLength(MAX_SLIDES);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('não loga quando está dentro do limite', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    sanitizarPlano(planoCom(3));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('corta título e explicação compridos e apara espaços', () => {
    const r = sanitizarPlano({
      titulo: '  '.padEnd(MAX_TITULO + 10, 'a'),
      disciplina: ' Matemática ',
      resumo_para_pais: 'x'.repeat(MAX_EXPLICACAO + 50),
      slides: [{ titulo: ` ${'t'.repeat(MAX_TITULO + 5)} `, explicacao: ` ${'e'.repeat(MAX_EXPLICACAO + 5)} ` }],
    });
    expect(r.titulo).toHaveLength(MAX_TITULO);
    expect(r.disciplina).toBe('Matemática');
    expect(r.resumo_para_pais).toHaveLength(MAX_EXPLICACAO);
    expect(r.slides[0].titulo).toHaveLength(MAX_TITULO);
    expect(r.slides[0].explicacao).toHaveLength(MAX_EXPLICACAO);
  });

  it('preserva um plano dentro dos limites', () => {
    const plano = planoCom(3);
    expect(sanitizarPlano(plano)).toEqual(plano);
  });
});
