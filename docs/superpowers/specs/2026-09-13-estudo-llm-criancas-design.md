# Estudo com LLM para Crianças (3º ao 9º ano)

## Visão Geral

Sistema web local que usa uma LLM multimodal para ajudar crianças do 3º ao 9º ano a estudar para provas. O pai fornece o conteúdo da revisão (texto, imagens e PDFs) e a LLM gera questões a partir dele. A criança responde as questões uma por vez, recebe feedback imediato com explicação, e ao final o sistema verifica se ela está preparada para a prova (70%+ de acertos).

Sem login. Sem segurança. Uso local.

## Stack

- **Framework:** Next.js 14 (App Router)
- **Estilo:** Tailwind CSS
- **Persistência:** SQLite (via `better-sqlite3`), arquivo único no projeto
- **LLM:** API REST compatível com OpenAI em `http://192.168.18.4:1234/v1` (multimodal, lê imagens)
- **PDF:** extração de texto via `pdf-parse` no servidor
- **Imagens:** enviadas para a LLM como base64

## Rotas

| Rota | Quem usa | O que faz |
|------|----------|-----------|
| `/` | Pai | Tela inicial: botão "Criar Revisão" + lista de revisões existentes |
| `/revisao` | Pai | Colar texto, upload de imagens/PDFs, submeter |
| `/estudar/[id]` | Criança | Responder questões uma por vez |
| `/resultado/[id]` | Criança/Pai | Ver resultado final + veredito da LLM |

## API Routes

| Rota | Função |
|------|--------|
| `POST /api/revisao` | Recebe conteúdo, envia para LLM, gera questões, salva sessão no SQLite |
| `POST /api/revisao/[id]/responder` | Recebe resposta da criança, envia para LLM avaliar, salva resposta |
| `GET /api/revisao/[id]` | Busca sessão com questões e respostas |
| `POST /api/revisao/[id]/finalizar` | Calcula score, envia desempenho para LLM, gera veredito |

## Integração com a LLM

Endpoint base: `http://192.168.18.4:1234/v1` (compatível com a API da OpenAI).

Três usos distintos, cada um com seu prompt:

1. **Geração de questões** — o backend envia o conteúdo (texto extraído + imagens em base64) e pede que a LLM gere questões em JSON estruturado. A LLM decide o número, o tipo (múltipla escolha, resposta digitada, ou misto) e a dificuldade. Formato esperado por questão: `{ tipo, enunciado, opcoes[], resposta_correta }`.

2. **Avaliação de resposta** — o backend envia a questão + a resposta dada pela criança e pede JSON `{ correto: boolean, explicacao: string }`. A explicação é sempre fornecida, mas com ênfase quando a resposta está errada.

3. **Veredito final** — o backend envia um resumo do desempenho (acertos, erros, questões erradas) e pede que a LLM avalie se o aluno está preparado para a prova (limiar de 70% de acertos) e dê um resumo amigável.

## Schema SQLite

- `sessoes` — `id`, `conteudo_texto`, `criada_em`
- `questoes` — `id`, `sessao_id`, `tipo`, `enunciado`, `opcoes_json`, `resposta_correta`, `ordem`
- `respostas` — `id`, `questao_id`, `resposta_dada`, `correto`, `explicacao`, `respondida_em`

## Uploads

- **Imagens:** salvas em `/uploads`, convertidas para base64 e enviadas para a LLM multimodal.
- **PDFs:** extração de texto via `pdf-parse` no servidor; o texto extraído é enviado para a LLM junto com o texto colado.

## Fluxo de Dados

### Criação de revisão
1. Pai cola texto + envia imagens/PDFs.
2. `POST /api/revisao`.
3. Backend extrai texto dos PDFs e converte imagens para base64.
4. Backend envia tudo para a LLM (prompt de geração de questões).
5. LLM retorna JSON com as questões.
6. Backend salva sessão + questões no SQLite.
7. Redireciona para `/estudar/[id]`.

### Responder questão
1. Criança responde (clica numa opção ou digita).
2. `POST /api/revisao/[id]/responder`.
3. Backend envia questão + resposta para a LLM.
4. LLM retorna `{ correto, explicacao }`.
5. Backend salva a resposta no SQLite.
6. Frontend mostra feedback (verde/vermelho) + explicação + botão "Próxima".

### Finalizar
1. Última questão respondida.
2. `POST /api/revisao/[id]/finalizar`.
3. Backend calcula score (acertos / total).
4. Backend envia resumo do desempenho para a LLM.
5. LLM retorna o veredito (preparado se >= 70%).
6. Redireciona para `/resultado/[id]`.

## UI e Componentes

**Tema visual:**
- Cores vibrantes: fundo claro (amarelo suave ou branco), botões em cores fortes (azul, verde, laranja, roxo).
- Letras grandes: mínimo 24px para enunciados, 20px para opções.
- Formas arredondadas: botões e cards com cantos suaves.
- Ícones divertidos: emojis ou ícones simples (estrelas, troféus, lupa).
- Animações leves: transição suave entre questões, feedback visual imediato.

**Componentes:**

| Componente | Tela | Descrição |
|------------|------|-----------|
| `Home` | `/` | Botão grande "Criar Revisão" + lista de revisões existentes |
| `FormRevisao` | `/revisao` | Textarea para texto, input de arquivo (imagens/PDFs), botão "Gerar Questões" |
| `LoadingQuestoes` | `/revisao` | Spinner animado enquanto a LLM gera as questões |
| `QuestaoCard` | `/estudar/[id]` | Enunciado + opções (botões) ou input para digitar |
| `FeedbackResposta` | `/estudar/[id]` | Correto/errado + explicação da LLM, botão "Próxima" |
| `ProgressoBarra` | `/estudar/[id]` | Barra de progresso (questão X de Y) |
| `ResultadoFinal` | `/resultado/[id]` | Score, veredito da LLM, lista de erros para revisar |

**Fluxo da criança:**
1. Vê a questão com letras grandes.
2. Clica numa opção OU digita a resposta.
3. Clica "Responder".
4. Vê feedback: verde (certo) ou vermelho (errado) + explicação.
5. Clica "Próxima".
6. Repete até terminar.
7. Vê resultado final com veredito.

## Tratamento de Erros

| Erro | Tratamento |
|------|------------|
| LLM não responde / timeout | Mensagem "Não consegui falar com o professor. Tente novamente." + botão retry |
| LLM retorna JSON inválido | Backend tenta parsear; se falhar, pede novamente (1 retry) |
| PDF ilegível | Mostra "Não consegui ler esse PDF" e continua com os outros |
| Imagem muito grande | Redimensiona no servidor antes de enviar |
| Sessão não encontrada | Página 404 amigável: "Essa revisão não existe mais" |

## Fora de Escopo

- Login e autenticação.
- Segurança (o sistema roda local, sem proteção).
- Mecânicas de jogo (o "jogo" é apenas o tema visual).
- Testes automatizados.
- Dispositivos separados (pai e criança usam o mesmo sistema, em telas diferentes).
