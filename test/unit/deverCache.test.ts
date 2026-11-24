// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashConteudo, VERSAO_PLANO } from '../../lib/deveres/cache';

describe('hashConteudo', () => {
  it('mesmo conteúdo e mesmos arquivos geram a mesma chave', () => {
    const a = hashConteudo('dever de matemática', ['h1', 'h2'], 'crianca');
    const b = hashConteudo('dever de matemática', ['h1', 'h2'], 'crianca');
    expect(a).toBe(b);
  });

  // O aluno que fotografa a mesma página em ordem inversa enviou o mesmo material.
  // Uma chave sensível à ordem gastaria 120s de GPU para devolver a mesma explicação.
  it('é independente da ordem dos arquivos', () => {
    expect(hashConteudo('dever', ['h1', 'h2'], 'crianca'))
      .toBe(hashConteudo('dever', ['h2', 'h1'], 'crianca'));
  });

  it('não muta o array de hashes recebido', () => {
    const hashes = ['h2', 'h1'];
    hashConteudo('dever', hashes, 'crianca');
    expect(hashes).toEqual(['h2', 'h1']);
  });

  it('muda com o conteúdo, com os arquivos e com o nível', () => {
    const base = hashConteudo('dever', ['h1'], 'crianca');
    expect(hashConteudo('dever outro', ['h1'], 'crianca')).not.toBe(base);
    expect(hashConteudo('dever', ['h2'], 'crianca')).not.toBe(base);
    expect(hashConteudo('dever', ['h1'], 'adulto')).not.toBe(base);
  });

  // Mudou o prompt ou o modelo? Sobe-se VERSAO_PLANO e as entradas antigas param de
  // servir. Sem o prefixo, trocar o PROMPT_PLANO pareceria inofensivo por dias.
  // Comparar com o digest calculado sem a versão prova que ela entra no hash.
  it('a versão do prompt entra na chave', () => {
    expect(VERSAO_PLANO).toMatch(/^v\d+$/);
    const semVersao = createHash('sha256')
      .update('dever').update('|').update('crianca')
      .digest('hex');
    expect(hashConteudo('dever', [], 'crianca')).not.toBe(semVersao);
  });
});
