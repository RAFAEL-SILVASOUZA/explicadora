-- AVISO: não renomeie este arquivo. Ele coexiste de propósito com
-- 007_pagamentos.sql (nasceram em branches paralelos; o runner ordena por nome
-- e aplica os dois). O nome é a chave da tabela `migrations`: renomear faria o
-- banco re-aplicar este arquivo, que NÃO é idempotente (os RENAME falham se já
-- aplicados) e o boot via instrumentation.ts morreria. Numeração nova: 010+.

-- O dever de casa deixa de ser animação em canvas + narração em áudio e passa a
-- ser slides curtos. A explicação escrita é o produto; cena, áudio e duração não
-- têm mais consumidores.

ALTER TABLE dever_passos RENAME COLUMN narracao TO explicacao;
ALTER TABLE dever_passos DROP COLUMN IF EXISTS cena;
ALTER TABLE dever_passos DROP COLUMN IF EXISTS audio_path;
ALTER TABLE dever_passos DROP COLUMN IF EXISTS duracao_ms;

-- Nome acompanha o produto: o aluno navega por slides, não por passos animados.
ALTER TABLE dever_passos RENAME TO dever_slides;
