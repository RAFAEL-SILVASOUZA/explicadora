CREATE TABLE IF NOT EXISTS planos (
  codigo text PRIMARY KEY,
  nome text NOT NULL,
  revisoes integer NOT NULL CHECK (revisoes > 0),
  preco_cents integer NOT NULL CHECK (preco_cents >= 0)
);

CREATE TABLE IF NOT EXISTS contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  sobrenome text NOT NULL,
  email text NOT NULL UNIQUE,
  senha_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  saldo_revisoes integer NOT NULL DEFAULT 0 CHECK (saldo_revisoes >= 0),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_por uuid NOT NULL REFERENCES contas(id),
  quantidade integer NOT NULL CHECK (quantidade > 0),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  plano_codigo text NOT NULL REFERENCES planos(codigo),
  lote_id uuid NOT NULL REFERENCES lotes(id),
  expira_em timestamptz NOT NULL,
  criado_por uuid NOT NULL REFERENCES contas(id),
  resgatado_por uuid REFERENCES contas(id),
  resgatado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  titulo text,
  conteudo_texto text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questoes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  revisao_id uuid NOT NULL REFERENCES revisoes(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  enunciado text NOT NULL,
  opcoes jsonb NOT NULL DEFAULT '[]',
  resposta_correta text NOT NULL,
  dica text NOT NULL DEFAULT '',
  ordem integer NOT NULL
);

CREATE TABLE IF NOT EXISTS respostas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  questao_id bigint NOT NULL REFERENCES questoes(id) ON DELETE CASCADE,
  resposta_dada text NOT NULL,
  correto boolean NOT NULL,
  explicacao text NOT NULL,
  respondida_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS movimentos_saldo (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conta_id uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('registro','resgate','consumo')),
  quantidade integer NOT NULL,
  token_id uuid REFERENCES tokens(id),
  revisao_id uuid REFERENCES revisoes(id),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revisoes_conta ON revisoes (conta_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_resgatado_por ON tokens (resgatado_por);
CREATE INDEX IF NOT EXISTS idx_tokens_expira_em ON tokens (expira_em);
CREATE INDEX IF NOT EXISTS idx_movimentos_conta ON movimentos_saldo (conta_id, criado_em DESC);

INSERT INTO planos (codigo, nome, revisoes, preco_cents) VALUES
  ('free', 'Free', 3, 0),
  ('pro', 'Pro', 20, 500),
  ('familia', 'Família', 50, 1500)
ON CONFLICT (codigo) DO NOTHING;
