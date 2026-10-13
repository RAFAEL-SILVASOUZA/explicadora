# Contas, Planos e Tokens (Estudo Divertido)

## Visão Geral

O projeto era um monólito local sem login (spec de 2026-09-13). Esta evolução adiciona: contas com email e senha, persistência em Postgres via Docker, planos consumíveis por token, área administrativa para gerar tokens e histórico de revisões por conta. Autenticação por JWT.

O core de geração de questões e avaliação de respostas não muda. O que muda é que toda revisão passa a pertencer a uma conta, e criar revisão consome saldo.

## Decisões aprovadas

| Tema | Decisão |
|------|---------|
| Banco | Postgres substitui o SQLite. Os dados atuais de `data/estudo.db` não são migrados. |
| Camada de dados | `pg` + migrações SQL + repositórios por agregado. Sem ORM. |
| Cota | Consumível e acumulável por token. Free dá 3 uma única vez. Ao esgotar, o usuário precisa de um novo token pago. |
| Planos | free 3 revisões, pro 20 revisões por R$ 5, família 50 revisões por R$ 15. |
| Pagamento | Não há gateway. O token gerado na área admin é a prova de compra. |
| Autenticação | JWT no header `Authorization: Bearer`, token guardado no localStorage pelo cliente. |
| Admin | Campo `role` na tabela de contas. Conta admin semeada pela migração a partir de `ADMIN_EMAIL` e `ADMIN_SENHA` no `.env`. |
| Tokens | Uso único, com expiração, geração em lote, registro de quem resgatou e quando. |

## Arquitetura

O monólito Next.js 14 (App Router) continua. Três camadas novas em volta do core:

### Camada de dados
- `lib/db/pool.ts`: `pg Pool` lendo `DATABASE_URL` do `.env`.
- `migrations/001_initial.sql` aplicada na subida do container por um runner pequeno (`npm run migrate`), idempotente e em ordem, com tabela `migrations` de controle.
- `lib/repos/contas.ts`, `lib/repos/tokens.ts`, `lib/repos/revisoes.ts`: funções nomeadas (`createConta`, `resgateToken`, `createRevisao`). Nenhum SQL fora dos repositórios.
- `docker-compose.yml` ganha o serviço `postgres` com volume nomeado. A `LLM_API_KEY` hoje commitada no compose sai para o `.env`.

### Camada de autenticação
- `lib/auth/jwt.ts`: assina e verifica HS256, segredo no `.env`, expiração de 7 dias, claims `sub` (id da conta) e `role`.
- `lib/auth/guard.ts`: lê `Authorization: Bearer`, valida, devolve a conta. Toda rota de API chama o guard no topo e responde 401 sem sessão. Rotas de admin exigem `role='admin'` e respondem 403.
- `lib/auth/senha.ts`: hash e verificação com `scrypt` de `node:crypto`. Sem dependência nova.

### Camada de quota
- `lib/quota.ts` com `consumirSaldo(contaId)`: transação com `SELECT ... FOR UPDATE` e `UPDATE ... SET saldo_revisoes = saldo_revisoes - 1 WHERE saldo_revisoes > 0`, devolvendo o novo saldo. É o único lugar que decrementa, então duas requisições simultâneas não gastam a mesma revisão.

## Rotas

| Rota | Função |
|------|--------|
| `POST /api/auth/register` | Cria conta com saldo 3 e movimento de registro. |
| `POST /api/auth/login` | Verifica senha, devolve JWT. |
| `GET /api/conta` | Plano atual, saldo, histórico de resgates. |
| `POST /api/tokens/resgate` | Resgata um código e soma revisões ao saldo. |
| `GET /api/admin/tokens` | Lista tokens com status e resgate. |
| `POST /api/admin/tokens` | Gera lote de tokens para um plano. |
| `POST /api/revisao` | Existe. Ganha guard e consumo de saldo. |
| `POST /api/revisao/[id]/responder` | Existe. Ganha guard e escopo por conta. |
| `GET /api/revisao/[id]` | Existe. Ganha guard e escopo por conta. |
| `POST /api/revisao/[id]/finalizar` | Existe. Ganha guard e escopo por conta. |

## Páginas

| Rota | Descrição |
|------|-----------|
| `/login`, `/cadastro` | Entrar e criar conta. |
| `/creditos` | Área exclusiva de créditos: saldo, plano atual, catálogo de pacotes, campo para colar token e extrato de resgates e consumos. Único lugar do app onde se resgata código. |
| `/conta` | Só o cadastro: nome, e-mail, conta desde quando. Aponta para `/creditos` e para `/revisoes`. |
| `/admin` | Gerar lote de tokens, listar tokens, ver resgates. |

As páginas atuais passam a chamar a API com o header Bearer, porque hoje chamam sem header.

## Modelo de dados

```
contas
  id uuid pk
  email text not null unique
  senha_hash text not null
  role text not null default 'user' check (role in ('user','admin'))
  saldo_revisoes integer not null default 0 check (saldo_revisoes >= 0)
  criado_em timestamptz not null default now()

planos  (referência, semeada na migração; não enum no código)
  codigo text pk            -- free, pro, familia
  nome text not null
  revisoes integer not null
  preco_cents integer not null

lotes
  id uuid pk
  criado_por uuid not null references contas(id)
  quantidade integer not null
  criado_em timestamptz not null default now()

tokens
  id uuid pk
  codigo text not null unique      -- legível para digitar, ex. PRO-7K4M-9XQ2
  plano_codigo text not null references planos(codigo)
  lote_id uuid not null references lotes(id)
  expira_em timestamptz not null   -- criado com expiração de 30 dias
  criado_por uuid not null references contas(id)
  resgatado_por uuid references contas(id)
  resgatado_em timestamptz

revisoes  (substitui sessoes)
  id uuid pk
  conta_id uuid not null references contas(id) on delete cascade
  titulo text
  conteudo_texto text not null
  criado_em timestamptz not null default now()

questoes
  id bigint generated always as identity pk
  revisao_id uuid not null references revisoes(id) on delete cascade
  tipo text not null
  enunciado text not null
  opcoes_json jsonb not null default '[]'
  resposta_correta text not null
  dica text not null default ''
  ordem integer not null

respostas
  id bigint generated always as identity pk
  questao_id bigint not null references questoes(id) on delete cascade
  resposta_dada text not null
  correto boolean not null
  explicacao text not null
  respondida_em timestamptz not null default now()

movimentos_saldo
  id bigint generated always as identity pk
  conta_id uuid not null references contas(id) on delete cascade
  tipo text not null check (tipo in ('registro','resgate','consumo'))
  quantidade integer not null
  token_id uuid references tokens(id)
  revisao_id uuid references revisoes(id)
  criado_em timestamptz not null default now()
```

Status de token (`disponível`, `resgatado`, `expirado`) é derivado por consulta, nunca armazenado, para não divergir do estado real.

"Plano atual" de uma conta, como exibido em `/creditos`, é o plano do último token resgatado; sem resgate, é `free`. O plano não define o saldo: o saldo é a soma dos resgates menos o consumo.

`revisoes.titulo` é nullable: a revisão gerada pela LLM não tem título, então a tela usa os primeiros caracteres do conteúdo quando ele está vazio.

A migração semeia `planos` com os três planos e a conta admin (`role='admin'`, saldo 0) a partir de `ADMIN_EMAIL` e `ADMIN_SENHA`. Se a conta já existe, a migração não a duplica.

### Índices
- `revisoes (conta_id, criado_em desc)`: histórico por conta.
- `tokens (resgatado_por)`: resgates por conta.
- `tokens (expira_em)`: expiração.
- `movimentos_saldo (conta_id, criado_em desc)`: extrato por conta.

A constraint `unique` em `tokens.codigo` é o que garante que dois resgates simultâneos do mesmo token não somam saldo.

## Fluxo de dados

### Registro
1. `POST /api/auth/register` com email e senha.
2. Transação: insert em `contas` com `saldo_revisoes = 3` e `movimentos_saldo` de tipo `registro`.
3. Email duplicado cai na constraint `unique` e devolve 409. Não há checagem prévia, para evitar race.

### Login
1. `POST /api/auth/login`.
2. Senha comparada com `senha_hash` via scrypt.
3. JWT assinado com `sub` e `role`.

### Criar revisão
1. `POST /api/revisao` com guard.
2. `consumirSaldo(contaId)` em transação com `FOR UPDATE`.
3. Saldo 0: 402 Payment Required, "Você usou suas revisões. Resgate um token para continuar."
4. Saldo positivo: chama a LLM, insere `revisoes` e `movimentos_saldo` de tipo `consumo`, commit no mesmo bloco. Se a LLM falha, rollback e o saldo volta.

Gastar antes da LLM evita pagar o custo do modelo sem ter quota.

### Resgate de token
1. `POST /api/tokens/resgate` com o código.
2. Transação única: `SELECT ... FOR UPDATE` no token.
3. Verifica `resgatado_por is null` e `expira_em > now()`.
4. Marca `resgatado_por` e `resgatado_em`, soma `planos.revisoes` ao saldo, grava `movimentos_saldo` de tipo `resgate`.

### Escopo por conta
Toda leitura de revisão verifica `revisoes.conta_id = conta.id` do JWT. Hoje as rotas aceitam qualquer id; isso passa a ser controle de acesso, não só "não encontrado".

## Tratamento de erros

| Erro | Tratamento |
|------|------------|
| Sem JWT ou JWT inválido/expirado | 401 |
| JWT válido em rota admin sem `role='admin'` | 403 |
| Email duplicado no registro | 409 |
| Senha incorreta no login | 401, sem dizer se o email existe |
| Saldo esgotado ao criar revisão | 402 |
| Código de token inexistente | 404 |
| Token já resgatado | 409 |
| Token expirado | 410 |
| Falha de conexão com Postgres | 500 com mensagem genérica; o erro do driver fica no log do servidor |
| `DATABASE_URL` ausente na subida | O runner de migração falha com mensagem explícita |
| LLM indisponível, JSON inválido, PDF ilegível, imagem grande | Preservados da spec anterior, agora em JSON em vez de redirecionamento |

## Testes

`vitest.config.ts` hoje usa `environment: 'jsdom'` e `lib/llm.test.ts` é integração real contra a LLM local. Isso não serve para a nova camada.

- **Repositório contra Postgres real:** serviço `postgres-test` no `docker-compose.yml` (porta separada, `POSTGRES_DB: estudo_test`). Helper `test/db.ts` aplica as migrações em schema de teste e trunca as tabelas entre casos. Sem mocks de banco: constraints e transações só são verificadas contra Postgres de verdade. `environment: 'node'` nesse conjunto.
- **Cobertura dos repositórios:** `consumirSaldo` com dois chamados concorrentes na mesma conta; saldo nunca negativo; consumo com saldo 0 não insere revisão; resgate duplo recusado; token expirado recusado; resgate soma o valor do plano e grava o movimento; conta A não lê revisão de conta B; email duplicado; saldo inicial 3 com movimento de registro.
- **Unidade sem banco:** hash e verificação de senha, assinatura e verificação de JWT, formatação do código de token, expiração.
- **A LLM fica fora dos testes de quota.** Os testes de `lib/llm.ts` continuam como estão, marcados como integração. Separar `npm run test:unit` e `npm run test:db`, porque `npm test` hoje depende de um modelo local lento e indisponível em CI.
- **Manual, não automatizado:** telas de `/login`, `/creditos`, `/conta` e `/admin`.

## Fora de Escopo

- Gateway de pagamento e cobrança automática.
- Renovação de cota por tempo: a cota é consumível por token, não mensal.
- Migrar os dados atuais do SQLite.
- E-mail transacional ao gerar token.
- Rate limiting e bloqueio de conta.
- Refresh token e revogação de sessão.
