-- Cache de planos de dever: o mesmo conteúdo (enunciado + arquivos) gera o
-- mesmo plano, então a LLM não precisa ser chamada de novo. O cache é por
-- conta: o hash identifica o conteúdo, a conta identifica o dono.

CREATE TABLE IF NOT EXISTS dever_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  hash text NOT NULL,
  nivel text NOT NULL DEFAULT 'crianca',
  plano jsonb NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_id, hash, nivel)
);

CREATE INDEX IF NOT EXISTS idx_dever_cache_conta ON dever_cache (conta_id, criado_em DESC);
