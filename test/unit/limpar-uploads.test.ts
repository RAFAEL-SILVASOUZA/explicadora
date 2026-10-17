import { describe, expect, it } from 'vitest';
import { pastasOrfas } from '@/scripts/limpar-uploads-orfaos';

describe('pastasOrfas', () => {
  it('aponta pasta sem linha em deveres', () => {
    expect(pastasOrfas(['a', 'b'], ['a'])).toEqual(['b']);
  });

  it('nada é órfão quando tudo tem linha', () => {
    expect(pastasOrfas(['a', 'b'], ['a', 'b'])).toEqual([]);
  });

  it('banco vazio torna tudo órfão', () => {
    expect(pastasOrfas(['a'], [])).toEqual(['a']);
  });

  it('ignora nomes de arquivo, só compara pastas', () => {
    expect(pastasOrfas(['a'], ['a'])).toEqual([]);
  });
});
