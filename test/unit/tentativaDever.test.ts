import { afterEach, describe, expect, it } from 'vitest';
import { guardarTentativaDever, lerTentativaDever, limparTentativaDever } from '@/lib/client/tentativaDever';

afterEach(() => localStorage.clear());

describe('tentativaDever', () => {
  it('guarda e lê a chave', () => {
    guardarTentativaDever('chave-1');
    expect(lerTentativaDever()).toBe('chave-1');
  });

  it('limpar remove', () => {
    guardarTentativaDever('chave-1');
    limparTentativaDever();
    expect(lerTentativaDever()).toBeNull();
  });

  it('não conflita com a tentativa de revisão', async () => {
    const { guardarTentativa, lerTentativa } = await import('@/lib/client/tentativa');
    guardarTentativa('revisao-1');
    guardarTentativaDever('dever-1');
    expect(lerTentativa()).toBe('revisao-1');
    expect(lerTentativaDever()).toBe('dever-1');
  });
});
