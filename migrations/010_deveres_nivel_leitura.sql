-- Nível do aluno (criança, adolescente, adulto) e status de leitura do dever.
-- O nível alimenta o prompt da explicadora; o status de leitura alimenta a
-- barra de progresso e o histórico no grid.

ALTER TABLE deveres ADD COLUMN IF NOT EXISTS nivel text NOT NULL DEFAULT 'crianca'
  CHECK (nivel IN ('crianca', 'adolescente', 'adulto'));

ALTER TABLE deveres ADD COLUMN IF NOT EXISTS lido_ate integer NOT NULL DEFAULT 0;

ALTER TABLE deveres ADD COLUMN IF NOT EXISTS concluido boolean NOT NULL DEFAULT false;
