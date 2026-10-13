-- Revogação de um código já resgatado. `revogado_em` marca o token; o estorno do que sobra
-- entra no extrato como movimento próprio, porque movimentos_saldo é o registro de tudo que
-- altera o saldo — um estorno invisível deixaria o número da conta sem explicação.
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS revogado_em timestamptz;

ALTER TABLE movimentos_saldo DROP CONSTRAINT IF EXISTS movimentos_saldo_tipo_check;
ALTER TABLE movimentos_saldo ADD CONSTRAINT movimentos_saldo_tipo_check
  CHECK (tipo IN ('registro','resgate','consumo','revogacao'));
