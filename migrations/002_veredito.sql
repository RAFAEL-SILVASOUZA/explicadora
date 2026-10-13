-- O veredito do professor é gerado pela LLM e passa a ser guardado na revisão, para que
-- a área de revisões mostre o resultado final sem chamar a LLM de novo a cada visita.
ALTER TABLE revisoes ADD COLUMN IF NOT EXISTS veredito text;
