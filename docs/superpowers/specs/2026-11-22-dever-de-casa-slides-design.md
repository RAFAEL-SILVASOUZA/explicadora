# Dever de Casa em Slides (explicação curta)

Data: 2026-11-22
Status: implementada. Substitui `2026-10-14-dever-de-casa-explicadora-design.md`.

## Motivo da mudança

O modelo anterior (canvas animado + narração Piper) entregava spectacle, não explicação:
o aluno queria entender o dever, não assistir a um desenho. Produto novo: **slides com
explicação simples e bem resumida**. Tudo de animação e áudio saiu do código e do banco.

## O que mudou

- **Contrato da LLM** (`lib/deveres/slides.ts`, `prompts.ts`): plano com `titulo`,
  `disciplina`, `resumo_para_pais` e 3 a 6 `slides` de `{ titulo (≤5 palavras),
  explicacao (2-3 frases) }`. O prompt manda ir direto ao conceito, ao método e a um
  exemplo com outros números. Sanitização limita 8 slides, 80 chars de título e
  600 chars de explicação (corta em vez de rejeitar).
- **Anti-vazamento continua** (`lib/deveres/llm.ts`): geração → auditoria → regeneração
  do slide (máx. 2x) → degradação com `FRASE_NEUTRA`. Como o slide é só texto, a
  neutralização é uma troca de texto (não existe mais "limpar a cena").
- **Banco** (`migrations/007_deveres_slides.sql`): `dever_passos` → `dever_slides`,
  `narracao` → `explicacao`, colunas `cena`/`audio_path`/`duracao_ms` removidas.
- **Tela da criança** (`app/deveres/[id]/page.tsx`): um card por slide (título + texto),
  contador "Slide X de N", botões anterior/próximo e setas do teclado. Sem play/pause,
  sem transcrição (o slide JÁ é o texto), sem canvas.
- **Removido**: `lib/deveres/{cena,desenho,animacao,timeline,wav,piper}.ts`,
  `CanvasExplicacao`, `TranscricaoDever`, `ControlesDever` (virou `ControlesSlides`),
  `lib/client/audio.ts`, rota `GET /api/dever/[id]/audio/[ordem]`, scripts
  `regenerar-audio` e `limpar-uploads-orfaos`, env `PIPER_*` e montes do docker-compose.

## O que não mudou

Fluxo de criação (transação + saldo + idempotência), coleta de materiais/biblioteca,
1 dever = 1 crédito, posse na leitura, grid e formulário do pai (só mudou o texto).

## Limpeza pendente no disco (não é código)

Pastas/binários do tempo do áudio: `piper-linux/`, `piper-voz/` e `uploads/deveres/`
(WAVs antigos). Não são rastreados pelo git; apagar é seguro quando o operador quiser.
