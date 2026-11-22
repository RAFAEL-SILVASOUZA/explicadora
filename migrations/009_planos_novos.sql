-- Preços novos do negócio: Free 2, Pro R$ 5,00 com 5, Max R$ 10,00 com 15
-- (o Max substitui o Família). A tabela planos é referência viva: a UI e o
-- resgate leem daqui, não há preço em código.

-- O rename familia -> max passaria por cima da FK de tokens.plano_codigo:
-- ON UPDATE CASCADE faz tokens ainda não resgatados acompanharem o código.
ALTER TABLE tokens DROP CONSTRAINT IF EXISTS tokens_plano_codigo_fkey;
ALTER TABLE tokens ADD CONSTRAINT tokens_plano_codigo_fkey
  FOREIGN KEY (plano_codigo) REFERENCES planos(codigo) ON UPDATE CASCADE;

UPDATE planos SET revisoes = 2                      WHERE codigo = 'free';
UPDATE planos SET revisoes = 5, preco_cents = 500   WHERE codigo = 'pro';
UPDATE planos SET codigo = 'max', nome = 'Max',
                  revisoes = 15, preco_cents = 1000 WHERE codigo = 'familia';
