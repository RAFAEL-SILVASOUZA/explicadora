CREATE TABLE IF NOT EXISTS deveres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  titulo text,
  disciplina text,
  serie_ano text NOT NULL DEFAULT 'fundamental_i_ii',
  conteudo_texto text NOT NULL DEFAULT '',
  resumo_para_pais text,
  chave_idempotencia text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dever_passos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dever_id uuid NOT NULL REFERENCES deveres(id) ON DELETE CASCADE,
  ordem integer NOT NULL,
  titulo text NOT NULL,
  narracao text NOT NULL,
  cena jsonb NOT NULL,
  audio_path text,
  duracao_ms integer,
  UNIQUE (dever_id, ordem)
);

CREATE INDEX IF NOT EXISTS idx_deveres_conta ON deveres (conta_id, criado_em DESC);

-- Igual ao índice de revisoes (004): a chave identifica a tentativa e só é única
-- por conta. Nulo não entra no índice, então deveres sem tentativa não colidem.
CREATE UNIQUE INDEX IF NOT EXISTS idx_deveres_chave
  ON deveres (conta_id, chave_idempotencia) WHERE chave_idempotencia IS NOT NULL;

-- O extrato de /creditos precisa distinguir consumo de revisão e consumo de dever.
ALTER TABLE movimentos_saldo ADD COLUMN IF NOT EXISTS dever_id uuid REFERENCES deveres(id);
