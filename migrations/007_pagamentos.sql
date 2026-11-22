-- Tabela de pedidos de pagamento (uma linha por sessão de checkout iniciada).
-- Garante idempotência no webhook: o saldo só é creditado quando status = 'pending'.
CREATE TABLE IF NOT EXISTS pedidos_pagamento (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id       uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  plano_codigo   text NOT NULL REFERENCES planos(codigo),
  mp_order_id    text UNIQUE,          -- ID retornado pelo Mercado Pago ao criar a order
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','failed','cancelled')),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_conta    ON pedidos_pagamento (conta_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_mp_order ON pedidos_pagamento (mp_order_id);

-- Estender movimentos_saldo para referenciar o pedido que gerou o crédito
ALTER TABLE movimentos_saldo
  ADD COLUMN IF NOT EXISTS pedido_id uuid REFERENCES pedidos_pagamento(id);
