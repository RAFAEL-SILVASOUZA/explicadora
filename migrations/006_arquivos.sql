-- Biblioteca de arquivos do aluno: o material é enviado uma vez e referenciado pelo id
-- nas outras telas (revisões e deveres), em vez de ser reenviado a cada criação.
CREATE TABLE IF NOT EXISTS arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  mime text NOT NULL,
  tamanho integer NOT NULL,
  caminho text NOT NULL,
  hash text NOT NULL,
  origem text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- A lista da página /arquivos vem na ordem da grid de revisões e deveres.
CREATE INDEX IF NOT EXISTS idx_arquivos_conta ON arquivos (conta_id, criado_em DESC);

-- O dedupe é um SELECT antes do INSERT, não um índice único: se dois envios do mesmo
-- conteúdo chegam juntos, o segundo apenas repete o arquivo em disco. Um índice único
-- devolveria 500 para o aluno que fotografou a mesma página duas vezes.
CREATE INDEX IF NOT EXISTS idx_arquivos_hash ON arquivos (conta_id, hash);
