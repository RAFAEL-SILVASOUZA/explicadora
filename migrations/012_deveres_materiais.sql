-- O dever precisa conseguir se regenerar sozinho. Hoje a regeneração só tem o texto
-- digitado: um dever criado a partir de foto não tem material arquivado para a LLM
-- reler, e o botão "gerar nova versão" falha exatamente no caso de uso principal.
--
-- arquivo_ids guarda quais itens da biblioteca alimentaram o plano. São ids, não
-- cópias: os bytes já vivem em arquivos e o dedupe por hash continua valendo. Com
-- eles a regeneração relê as mesmas fotos e recomputa o mesmo hash de cache, que é
-- o que permite substituir o plano em cache em vez de deixar o antigo servir.

ALTER TABLE deveres ADD COLUMN IF NOT EXISTS arquivo_ids uuid[] NOT NULL DEFAULT '{}';
