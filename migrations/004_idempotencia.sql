-- Idempotência da submissão: a chave é gerada pelo cliente por tentativa e sobrevive
-- à saída no localStorage. O índice único parcial por conta faz a mesma tentativa
-- retornar a revisão existente em vez de debitar de novo. Parcial porque submissões
-- antigas (e o avancar) têm chave NULL, e múltiplos NULLs não conflitam.
ALTER TABLE revisoes ADD COLUMN IF NOT EXISTS chave_idempotencia text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_revisoes_conta_chave
  ON revisoes (conta_id, chave_idempotencia)
  WHERE chave_idempotencia IS NOT NULL;
