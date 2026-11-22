-- Dever de casa passa a custar meia revisão; revisão continua em 1. O saldo
-- inteiro deixa de representar o modelo: vira numeric com uma casa decimal.
-- O CHECK (saldo_revisoes >= 0) sobrevive à troca de tipo.

ALTER TABLE contas ALTER COLUMN saldo_revisoes TYPE numeric(6,1);
ALTER TABLE contas ALTER COLUMN saldo_revisoes SET DEFAULT 0;

-- O extrato registra o consumo do dever como -0.5.
ALTER TABLE movimentos_saldo ALTER COLUMN quantidade TYPE numeric(6,1);
