-- O dever de casa deixa de ser animação em canvas + narração em áudio e passa a
-- ser slides curtos. A explicação escrita é o produto; cena, áudio e duração não
-- têm mais consumidores.

ALTER TABLE dever_passos RENAME COLUMN narracao TO explicacao;
ALTER TABLE dever_passos DROP COLUMN IF EXISTS cena;
ALTER TABLE dever_passos DROP COLUMN IF EXISTS audio_path;
ALTER TABLE dever_passos DROP COLUMN IF EXISTS duracao_ms;

-- Nome acompanha o produto: o aluno navega por slides, não por passos animados.
ALTER TABLE dever_passos RENAME TO dever_slides;
