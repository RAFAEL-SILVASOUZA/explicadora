import { createHash } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { Plano } from './slides';
import { NivelAluno } from '../types';

// Versão dos prompts e do modelo. Mudou o PROMPT_PLANO, o PROMPT_PLANO_NIVEL ou o
// modelo da LLM? Sobe-se o sufixo: as entradas antigas param de servir sozinhas, sem
// rotina de limpeza. Sem isto a mudança de prompt pareceria inofensiva por dias.
export const VERSAO_PLANO = 'v1';

// Hash do conteúdo: enunciado + hashes dos arquivos. Mesmo conteúdo gera o
// mesmo plano, então a LLM não precisa ser chamada de novo.
//
// Os hashes vão ordenados: o aluno que fotografa a mesma página em ordem inversa
// enviou o mesmo material, e uma chave sensível à ordem desperdiçaria uma chamada de
// 120s de GPU para devolver a mesma explicação.
export function hashConteudo(conteudoTexto: string, hashesArquivos: string[], nivel: NivelAluno): string {
  const h = createHash('sha256');
  h.update(VERSAO_PLANO);
  h.update('|').update(conteudoTexto);
  for (const hash of [...hashesArquivos].sort()) h.update('|').update(hash);
  h.update('|').update(nivel);
  return h.digest('hex');
}

export async function getCache(
  client: PoolClient | Pool, contaId: string, hash: string,
): Promise<Plano | null> {
  const { rows } = await client.query(
    'SELECT plano FROM dever_cache WHERE conta_id = $1 AND hash = $2',
    [contaId, hash],
  );
  if (!rows[0]) return null;
  return rows[0].plano as Plano;
}

export async function setCache(
  client: PoolClient | Pool, contaId: string, hash: string, nivel: NivelAluno, plano: Plano,
): Promise<void> {
  await client.query(
    `INSERT INTO dever_cache (conta_id, hash, nivel, plano)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (conta_id, hash, nivel) DO UPDATE SET plano = EXCLUDED.plano, criado_em = now()`,
    [contaId, hash, nivel, JSON.stringify(plano)],
  );
}
