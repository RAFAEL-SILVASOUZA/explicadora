# Design: higiene dos pontos de atenção da revisão (2026-11-26)

## Intenção e porquê

A revisão do projeto levantou quatro pontos de atenção. O pedido foi tratá-los
**com cautela**: resolver o que dá para resolver sem risco e não arriscar o que
exige projeto próprio. Quem sofre com decisão errada aqui é o ambiente de
produção (migrations rodam no boot).

## O que os pontos são, de verdade (investigado)

1. **Migrations `007_deveres_slides.sql` e `007_pagamentos.sql`.** O runner
   (`lib/db/migrate.ts`) rastreia por nome exato e aplica em ordem alfabética;
   os dois coexistem sem conflito e sem dependência cruzada. Não há bug
   funcional. Renomear é a opção perigosa: as migrations rodam no boot
   (`instrumentation.ts`) e `007_deveres_slides.sql` não é idempotente
   (`RENAME COLUMN`/`RENAME TO` falham se já aplicadas) — renomear um arquivo
   já aplicado derruba o app no start.
2. **`progress.txt` na raiz.** Não é resíduo: é diário curado e datado das
   mudanças aplicadas. Estava sinalizado como lixo por engano.
3. **Next 14.2.5.** Estável; a série 14.2.x recebeu correções de segurança em
   patches posteriores.
4. **LangChain.** `@langchain/core`/`@langchain/openai` na v1 (não
   deprecated), uso estreito e confinado a `lib/llm.ts` + `lib/deveres/llm.ts`,
   com testes (`test:llm`).

## Metas

- Fixar por escrito a regra de numeração de migrations para evitar a próxima
  colisão.
- Raiz do repo limpa, sem perder o diário.
- Next no último patch da série 14.2.x (correções de segurança).

## Não-metas / anti-metas

- **Não** renomear nenhuma migration já aplicada (risco de quebrar o boot).
- **Não** fazer upgrade de major do Next (14 → 15/16): exige React 19 e
  `params`/`searchParams` async em todas as páginas dinâmicas — projeto à
  parte. Anti-meta: transformar uma higiene numa quebra de produção.
- **Não** trocar LangChain pelo SDK da OpenAI agora: pouco retorno, risco no
  caminho central de geração de conteúdo. Se um dia houver dor concreta
  (bug, tamanho, API), vira projeto próprio.

## Restrições

- Migrations são rastreadas pelo **nome do arquivo** como chave primária da
  tabela `migrations`; o que entra na tabela nunca muda.
- Verificação antes de commitar: `npm run test` e `npm run build` verdes.

## Abordagens consideradas

- **(a) Só higiene segura** — documentar migrations, mover o diário para
  `docs/`, patch bump do Next dentro da série 14.2.x. **Escolhida**: resolve
  tudo que é seguro tocar, zero risco de produção.
- **(b) Higiene + major do Next** — vai contra a cautela pedida (React 19 +
  codemod de `params` em todas as rotas dinâmicas).
- **(c) Higiene + troca do LangChain** — refatorar o caminho LLM central sem
  dor concreta que a justifique.

(b) e (c) ficam arquivados como candidatos legítimos para pedidos futuros.

## Decisões de execução (minhas, corrigíveis)

- Documentação da regra: comentário no rodapé do `LESSONS.md` (é o lugar onde
  o projeto já guarda essas lições) mais um comentário curto no topo de cada
  007 explicando por que os dois números convivem.
- `git mv progress.txt docs/progresso.md` — histórico preservado, raiz limpa.
- Next: `npm install next@14.2` (último patch da série), depois testes e
  build.

## O que fica a critério de quem implementa

- Ordem exata dos passos e redação final dos comentários, desde que fiéis ao
  acima.
