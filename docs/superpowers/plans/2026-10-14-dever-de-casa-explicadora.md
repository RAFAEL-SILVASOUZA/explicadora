# Dever de Casa com Explicadora Visual — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nova área "Deveres" em que o pai fotografa o dever de casa e a criança recebe uma explicação animada em canvas, narrada em áudio local, sem nunca revelar a resposta do exercício.

**Architecture:** O LLM de visão devolve um *storyboard* (JSON validado por Zod: passos com narração + cena em primitivas de canvas com coordenadas normalizadas). Uma segunda chamada LLM audita vazamento de resposta. O servidor sintetiza um WAV por passo com Piper e grava tudo em Postgres dentro de uma transação que também debita o crédito. O cliente tem um renderizador de canvas 2D cujo motor de animação é uma função pura, sincronizada pela duração real de cada áudio.

**Tech Stack:** Next.js 14 (App Router), PostgreSQL via `pg`, LangChain `ChatOpenAI` com `withStructuredOutput`, Zod v4, `sharp`, `pdf-parse`, Piper TTS (binário local), vitest (jsdom + node), Tailwind v3.

**Spec:** `docs/superpowers/specs/2026-10-14-dever-de-casa-explicadora-design.md`

## Global Constraints

- Next.js 14.2.5, App Router, `params` como objeto plano (`{ params: { id } }`), sem `await params`.
- Tailwind CSS v3: **não** migrar para v4. Usar as cores existentes de `tailwind.config.js` (`primary`, `secondary`, `success-ink`, `danger`, `bg`, `ink`) e as classes utilitárias globais `card`, `btn-primary`, `btn-secondary`, `badge`, `input`.
- Sem shadcn/Radix. Componentes com as classes globais de `app/globals.css`.
- Nenhum SQL fora de `lib/repos/`. Transações só por `comTransacao` de `lib/repos/transacao.ts`.
- Zod v4 (`z.string()`, `z.discriminatedUnion`, `.default()`); o projeto já usa `zod@^4.6.5`.
- Testes: unitários em `test/unit` e `components/**/*.test.tsx` (`npm test`); testes de banco em `test/db` com `npm run test:db` (`--no-file-parallelism`); integração de LLM em `*.test.ts` ao lado do módulo (`npm run test:llm`).
- Banco de teste: `DATABASE_URL_TEST` ou `postgres://estudo:estudo@localhost:5404/estudo_test` (ver `test/db/helper.ts`).
- Imagens enviadas à LLM passam por `processarImagem` (`lib/imagem.ts`) e pelo limite `MAX_IMAGENS = 40` (`lib/constantes.ts`).
- Copy em pt-BR, tom da mascote "Lia". Erro de LLM: "Não consegui falar com a explicadora. Tente novamente."
- Regra de produto inegociável: **a explicação nunca enuncia o resultado do exercício fotografado.**
- Faixa etária fixa na v1: 3º ao 8º ano do Fundamental. Sem seletor de série no formulário.
- Commit após cada task, mensagem `feat(deveres): ...` / `test(deveres): ...` / `chore(deveres): ...`.

---

## Estrutura de arquivos

Criar:

| Arquivo | Responsabilidade única |
|---|---|
| `migrations/005_deveres.sql` | Tabelas `deveres`, `dever_passos`, coluna `movimentos_saldo.dever_id` |
| `lib/deveres/cena.ts` | Schemas Zod do storyboard + sanitização de coordenadas/limites |
| `lib/deveres/timeline.ts` | Duração do passo e progresso (funções puras) |
| `lib/deveres/wav.ts` | Duração em ms lida do cabeçalho RIFF de um WAV |
| `lib/deveres/animacao.ts` | `estadoDoPasso`: quais primitivas aparecem e com quanto progresso |
| `lib/deveres/desenho.ts` | Pinta uma primitiva num `CanvasRenderingContext2D` |
| `lib/deveres/prompts.ts` | Texto dos prompts de storyboard, regeneração e auditoria |
| `lib/deveres/llm.ts` | `gerarStoryboard`, `regenerarPasso`, `revisarVazamento`, `gerarStoryboardSeguro` |
| `lib/deveres/piper.ts` | Síntese local de um WAV por narração |
| `lib/repos/deveres.ts` | CRUD de `deveres` e `dever_passos` |
| `lib/client/audio.ts` | Download autenticado do WAV como object URL |
| `lib/client/tentativaDever.ts` | Chave de idempotência da tentativa de dever (separada da de revisão) |
| `components/deveres/DeverForm.tsx` | Formulário do pai |
| `components/deveres/DeverGrid.tsx` | Grid da área do pai |
| `components/deveres/CanvasExplicacao.tsx` | `<canvas>` + `requestAnimationFrame` |
| `components/deveres/ControlesDever.tsx` | play/pause, anterior, repetir, próximo, "Ver texto" |
| `components/deveres/TranscricaoDever.tsx` | Transcrição acessível de todos os passos |
| `app/deveres/page.tsx` | Grid |
| `app/deveres/nova/page.tsx` | Criação |
| `app/deveres/[id]/page.tsx` | Tela da criança |
| `app/api/dever/route.ts` | `POST` criação |
| `app/api/dever/[id]/route.ts` | `GET` storyboard |
| `app/api/deveres/route.ts` | `GET` grid |
| `app/api/dever/[id]/audio/[ordem]/route.ts` | `GET` WAV autenticado |
| `scripts/limpar-uploads-orfaos.ts` | Remove pastas de áudio sem linha em `deveres` |
| `test/unit/cena.test.ts` | Sanitização e limites |
| `test/unit/timeline.test.ts` | Duração e progresso |
| `test/unit/wav.test.ts` | Parser RIFF |
| `test/unit/animacao.test.ts` | Motor da animação |
| `test/db/deveres.test.ts` | Repositório + migração |
| `test/db/dever-route.test.ts` | Rota POST (saldo, idempotência, posse) |
| `components/deveres/DeverForm.test.tsx` | Validação do form |
| `components/deveres/ControlesDever.test.tsx` | Eventos dos controles |

Modificar:

| Arquivo | O quê |
|---|---|
| `lib/types.ts` | Tipos `Dever`, `DeverPasso`, `ResumoDever`, `DeverCompleto` |
| `lib/repos/movimentos.ts` | `vincularMovimentoADever`, `dever_id` em `extratoConta` |
| `components/Header.tsx` | Link "Deveres" |
| `test/db/helper.ts` | `deveres` e `dever_passos` em `TABELAS` |
| `test/db/migrations.test.ts` | Lista esperada de tabelas |
| `test/db/admin.test.ts` | Coluna nova no extrato (só se o teste asserting a lista de colunas falhar) |
| `components/Header.test.tsx` | Link "Deveres" presente |
| `.env.example` | `PIPER_BIN`, `PIPER_MODEL` |
| `package.json` | Script `limpar-uploads` |

---

## Task 1: Migração 005 e fixtures de teste

**Files:**
- Create: `migrations/005_deveres.sql`
- Modify: `test/db/helper.ts:11`
- Modify: `test/db/migrations.test.ts:13-15`
- Test: `test/db/migrations.test.ts`

**Interfaces:**
- Consumes: `aplicarMigracoes` de `lib/db/migrate.ts` (aplica `.sql` em ordem lexicográfica, um arquivo por transação).
- Produces: tabelas `deveres(id, conta_id, titulo, disciplina, serie_ano, conteudo_texto, resumo_para_pais, chave_idempotencia, criado_em)` e `dever_passos(id, dever_id, ordem, titulo, narracao, cena, audio_path, duracao_ms)`; coluna `movimentos_saldo.dever_id`.

- [ ] **Step 1: Escrever o teste que falha**

Em `test/db/migrations.test.ts`, substituir o `toEqual` da primeira test por:

```ts
test('migração cria as tabelas do modelo', async () => {
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`
  );
  expect(rows.map(r => r.table_name)).toEqual([
    'contas', 'dever_passos', 'deveres', 'lotes', 'migrations', 'movimentos_saldo',
    'planos', 'questoes', 'respostas', 'revisoes', 'tokens',
  ]);
});
```

E acrescentar ao mesmo arquivo:

```ts
test('migração 005 cria a chave única parcial de deveres', async () => {
  await pool.query(
    `INSERT INTO contas (nome, sobrenome, email, senha_hash) VALUES ('A','B','chave@teste.com','h')`
  );
  const { rows: contaRows } = await pool.query(`SELECT id FROM contas WHERE email = 'chave@teste.com'`);
  const contaId = contaRows[0].id;

  await pool.query(
    `INSERT INTO deveres (conta_id, conteudo_texto, chave_idempotencia) VALUES ($1, 'x', 'k1')`,
    [contaId],
  );
  await expect(
    pool.query(`INSERT INTO deveres (conta_id, conteudo_texto, chave_idempotencia) VALUES ($1, 'x', 'k1')`, [contaId]),
  ).rejects.toThrow();

  // chave nula não colide: dois deveres sem chave convivem
  await pool.query(`INSERT INTO deveres (conta_id, conteudo_texto) VALUES ($1, 'y')`, [contaId]);
  const { rows } = await pool.query(`SELECT count(*)::int AS c FROM deveres WHERE conta_id = $1`, [contaId]);
  expect(rows[0].c).toBe(3);
});
```

- [ ] **Step 2: Rodar para confirmar a falha**

Run: `npm run test:db -- test/db/migrations.test.ts`
Expected: FAIL, "relation \"deveres\" does not exist" e a lista de tabelas sem `dever_passos`/`deveres`.

- [ ] **Step 3: Escrever a migração**

`migrations/005_deveres.sql`:

```sql
CREATE TABLE IF NOT EXISTS deveres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  titulo text,
  disciplina text,
  serie_ano text NOT NULL DEFAULT 'fundamental_i_ii',
  conteudo_texto text NOT NULL DEFAULT '',
  resumo_para_pais text,
  chave_idempotencia text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dever_passos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dever_id uuid NOT NULL REFERENCES deveres(id) ON DELETE CASCADE,
  ordem integer NOT NULL,
  titulo text NOT NULL,
  narracao text NOT NULL,
  cena jsonb NOT NULL,
  audio_path text,
  duracao_ms integer,
  UNIQUE (dever_id, ordem)
);

CREATE INDEX IF NOT EXISTS idx_deveres_conta ON deveres (conta_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_dever_passos_dever ON dever_passos (dever_id, ordem);

-- Igual ao índice de revisoes (004): a chave identifica a tentativa e só é única
-- por conta. Nulo não entra no índice, então deveres sem tentativa não colidem.
CREATE UNIQUE INDEX IF NOT EXISTS idx_deveres_chave
  ON deveres (conta_id, chave_idempotencia) WHERE chave_idempotencia IS NOT NULL;

-- O extrato de /creditos precisa distinguir consumo de revisão e consumo de dever.
ALTER TABLE movimentos_saldo ADD COLUMN IF NOT EXISTS dever_id uuid REFERENCES deveres(id);
```

- [ ] **Step 4: Atualizar o fixture de limpeza**

Em `test/db/helper.ts`, linha 11:

```ts
const TABELAS = ['contas', 'planos', 'lotes', 'tokens', 'revisoes', 'questoes', 'respostas', 'movimentos_saldo', 'deveres', 'dever_passos'];
```

- [ ] **Step 5: Rodar os testes de banco**

Run: `npm run test:db`
Expected: PASS em todos os arquivos (inclusive `revisao-route.test.ts`, provando que a coluna nova não quebrou o extrato).

- [ ] **Step 6: Commit**

```bash
git add migrations/005_deveres.sql test/db/helper.ts test/db/migrations.test.ts
git commit -m "feat(deveres): tabelas de deveres e passos com idempotencia por conta"
```

---

## Task 2: Schemas e sanitização do storyboard

**Files:**
- Create: `lib/deveres/cena.ts`
- Test: `test/unit/cena.test.ts`

**Interfaces:**
- Consumes: nada (módulo folha, sem dependência de servidor).
- Produces:
  - `const MAX_PASSOS = 8`, `const MAX_PRIMITIVOS_POR_CENA = 24`
  - `type Primitivo`, `type Cena`, `type Passo`, `type Storyboard`
  - `StoryboardSchema`, `PassoSchema`, `CenaSchema` (Zod)
  - `function sanitizarStoryboard(sb: Storyboard): Storyboard`
  - `function sanitizarCena(cena: Cena): Cena`

- [ ] **Step 1: Escrever o teste que falha**

`test/unit/cena.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  MAX_PASSOS, MAX_PRIMITIVOS_POR_CENA, StoryboardSchema,
  sanitizarStoryboard, sanitizarCena, type Storyboard,
} from '@/lib/deveres/cena';

function cenaCom(...primitivos: unknown[]) {
  return { fundo: '#FDF6EC', primitivos } as never;
}

function passo(n: number) {
  return {
    titulo: `Passo ${n}`,
    narracao: 'Frase de narração.',
    cena: cenaCom({ kind: 'texto', x: 0.5, y: 0.5, valor: 'oi', tamanho: 0.1 }),
  };
}

function storyboard(passos: unknown[]): Storyboard {
  return {
    titulo: 'Soma com barras',
    disciplina: 'Matemática',
    resumo_para_pais: 'A Lia explica o método das barras.',
    passos,
  } as Storyboard;
}

describe('StoryboardSchema', () => {
  it('aceita um storyboard mínimo', () => {
    const r = StoryboardSchema.safeParse(storyboard([passo(1)]));
    expect(r.success).toBe(true);
  });

  it('rejeita kind desconhecido', () => {
    const r = StoryboardSchema.safeParse(storyboard([
      { titulo: 'x', narracao: 'y', cena: cenaCom({ kind: 'grafico_3d', x: 0.5, y: 0.5 }) },
    ]));
    expect(r.success).toBe(false);
  });

  it('default fundo quando ausente', () => {
    const r = StoryboardSchema.safeParse(storyboard([
      { titulo: 'x', narracao: 'y', cena: { primitivos: [] } },
    ]));
    expect(r.success && r.data.passos[0].cena.fundo).toBe('#FDF6EC');
  });
});

describe('sanitizarStoryboard', () => {
  it('trunca para os MAX_PASSOS primeiros passos', () => {
    const muitos = Array.from({ length: MAX_PASSOS + 3 }, (_, i) => passo(i + 1));
    expect(sanitizarStoryboard(storyboard(muitos)).passos).toHaveLength(MAX_PASSOS);
  });

  it('não corta quando o número de passos está no limite', () => {
    const exatos = Array.from({ length: MAX_PASSOS }, (_, i) => passo(i + 1));
    expect(sanitizarStoryboard(storyboard(exatos)).passos).toHaveLength(MAX_PASSOS);
  });
});

describe('sanitizarCena', () => {
  it('clampa coordenada acima de 1', () => {
    const cena = sanitizarCena(cenaCom({ kind: 'circulo', x: 1.7, y: -0.4, r: 0.2, cor: '#7C5CFC' }));
    expect(cena.primitivos[0]).toMatchObject({ x: 1, y: 0 });
  });

  it('clampa aparece_em para dentro de 0..1', () => {
    const cena = sanitizarCena(cenaCom({ kind: 'circulo', x: 0.5, y: 0.5, r: 0.1, cor: '#000', aparece_em: 2.5 }));
    expect(cena.primitivos[0]).toMatchObject({ aparece_em: 1 });
  });

  it('trunca primitivos acima do limite', () => {
    const muitos = Array.from({ length: MAX_PRIMITIVOS_POR_CENA + 5 }, () =>
      ({ kind: 'circulo', x: 0.5, y: 0.5, r: 0.1, cor: '#000' }));
    expect(sanitizarCena(cenaCom(...muitos)).primitivos).toHaveLength(MAX_PRIMITIVOS_POR_CENA);
  });

  it('descarta primitiva de tamanho não positivo', () => {
    const cena = sanitizarCena(cenaCom({ kind: 'circulo', x: 0.5, y: 0.5, r: 0, cor: '#000' }));
    expect(cena.primitivos).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar para confirmar a falha**

Run: `npx vitest run test/unit/cena.test.ts`
Expected: FAIL, "Failed to load '@/lib/deveres/cena'".

- [ ] **Step 3: Implementar**

`lib/deveres/cena.ts`:

```ts
import { z } from 'zod';

// Limites de segurança: o contexto do modelo de visão é apertado e o canvas da
// criança não pode receber uma cena com centenas de formas.
export const MAX_PASSOS = 8;
export const MAX_PRIMITIVOS_POR_CENA = 24;

// Coordenadas são normalizadas em 0..1 nos dois eixos: o renderizador multiplica
// pelo tamanho efetivo do canvas, então o modelo não precisa conhecer a tela.
const coord = z.number();
const cor = z.string().regex(/^#[0-9a-fA-F]{3,8}$/).default('#7C5CFC');

const base = {
  x: coord,
  y: coord,
  aparece_em: z.number().default(0),
  animacao: z.enum(['fade', 'desenhar', 'crescer', 'pular']).default('fade'),
};

const PrimitivoSchema = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('retangulo'), w: coord, h: coord, cor, raio: z.number().default(0) }),
  z.object({ ...base, kind: z.literal('circulo'), r: coord, cor }),
  z.object({ ...base, kind: z.literal('linha'), x2: coord, y2: coord, cor, espessura: z.number().default(0.004) }),
  z.object({ ...base, kind: z.literal('seta'), x2: coord, y2: coord, cor, espessura: z.number().default(0.006) }),
  z.object({
    ...base, kind: z.literal('texto'), valor: z.string(), tamanho: coord,
    cor: cor.default('#2D2A3E'), alinhamento: z.enum(['esquerda', 'centro', 'direita']).default('esquerda'),
  }),
  z.object({ ...base, kind: z.literal('emoji'), valor: z.string(), tamanho: coord }),
  z.object({
    ...base, kind: z.literal('reta_numerica'), w: coord,
    minimo: z.number(), maximo: z.number(), marcas: z.array(z.number()).default([]),
    destaque: z.number().optional(), rotulo: z.string().default(''), cor,
  }),
  z.object({
    ...base, kind: z.literal('barra_modelo'), w: coord, h: coord,
    partes: z.array(z.object({ valor: z.number(), rotulo: z.string().default(''), cor: cor.optional() })).default([]),
  }),
  z.object({
    ...base, kind: z.literal('balanca'), w: coord,
    prato_esquerdo: z.array(z.string()).default([]),
    prato_direito: z.array(z.string()).default([]),
    inclinacao: z.number().default(0), cor,
  }),
  z.object({
    ...base, kind: z.literal('blocos'), colunas: z.number().int().min(1), itens: z.number().int().min(1),
    tipo: z.enum(['quadrado', 'moeda']).default('quadrado'), cor,
  }),
  z.object({ ...base, kind: z.literal('destaque'), w: coord, h: coord }),
]);

const CenaSchema = z.object({
  fundo: cor.default('#FDF6EC'),
  primitivos: z.array(PrimitivoSchema),
});

const PassoSchema = z.object({
  titulo: z.string(),
  narracao: z.string(),
  cena: CenaSchema,
});

export const StoryboardSchema = z.object({
  titulo: z.string(),
  disciplina: z.string(),
  resumo_para_pais: z.string(),
  passos: z.array(PassoSchema),
});

export type Primitivo = z.infer<typeof PrimitivoSchema>;
export type Cena = z.infer<typeof CenaSchema>;
export type Passo = z.infer<typeof PassoSchema>;
export type Storyboard = z.infer<typeof StoryboardSchema>;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// O modelo erra coordenadas com frequência (1200 em vez de 0.8, -0.2). Clampar
// preserva a intenção em vez de descartar a cena inteira.
function clamparCoordenadas(p: Record<string, unknown>): Record<string, unknown> {
  const saida = { ...p };
  for (const chave of ['x', 'y', 'x2', 'y2', 'aparece_em']) {
    if (typeof saida[chave] === 'number') saida[chave] = clamp01(saida[chave] as number);
  }
  return saida;
}

// Forma sem área visível é ruído: um círculo de raio 0 ou uma barra de altura 0
// ocupam o orçamento de primitivos sem ensinar nada.
function temTamanhoVisivel(p: Record<string, unknown>): boolean {
  for (const chave of ['r', 'w', 'h', 'tamanho']) {
    if (chave in p && typeof p[chave] === 'number' && (p[chave] as number) <= 0) return false;
  }
  return true;
}

export function sanitizarCena(cena: Cena): Cena {
  const primitivos = cena.primitivos
    .map((p) => clamparCoordenadas(p as Record<string, unknown>))
    .filter(temTamanhoVisivel)
    .slice(0, MAX_PRIMITIVOS_POR_CENA);
  return { ...cena, primitivos } as Cena;
}

export function sanitizarStoryboard(sb: Storyboard): Storyboard {
  return {
    ...sb,
    passos: sb.passos
      .slice(0, MAX_PASSOS)
      .map((p) => ({ ...p, cena: sanitizarCena(p.cena) })),
  };
}
```

- [ ] **Step 4: Rodar para confirmar o passo**

Run: `npx vitest run test/unit/cena.test.ts`
Expected: PASS (10 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/deveres/cena.ts test/unit/cena.test.ts
git commit -m "feat(deveres): schemas zod do storyboard e sanitizacao de cena"
```

---

## Task 3: Timeline e duração de WAV

**Files:**
- Create: `lib/deveres/timeline.ts`
- Create: `lib/deveres/wav.ts`
- Test: `test/unit/timeline.test.ts`
- Test: `test/unit/wav.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `const PALAVRAS_POR_SEGUNDO = 2.6`, `const DURACAO_MINIMA_MS = 1200`, `const DURACAO_MAXIMA_MS = 45_000`
  - `function duracaoDoPasso(passo: { narracao: string; duracao_ms: number | null }): number`
  - `function progressoDoPasso(decorridoMs: number, duracaoMs: number): number`
  - `function duracaoMsDoWav(buffer: Buffer): number | null`

- [ ] **Step 1: Escrever os testes que falham**

`test/unit/timeline.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DURACAO_MAXIMA_MS, DURACAO_MINIMA_MS, duracaoDoPasso, progressoDoPasso } from '@/lib/deveres/timeline';

describe('duracaoDoPasso', () => {
  it('usa a duração real do áudio quando existe', () => {
    expect(duracaoDoPasso({ narracao: 'qualquer coisa', duracao_ms: 3400 })).toBe(3400);
  });

  it('estima por palavras quando o áudio está ausente', () => {
    // 13 palavras a 2,6 palavras/s ≈ 5000 ms
    const narracao = 'a b c d e f g h i j k l m';
    expect(duracaoDoPasso({ narracao, duracao_ms: null })).toBe(5000);
  });

  it('nunca devolve menos que o mínimo', () => {
    expect(duracaoDoPasso({ narracao: 'oi', duracao_ms: null })).toBe(DURACAO_MINIMA_MS);
    expect(duracaoDoPasso({ narracao: 'oi', duracao_ms: 10 })).toBe(DURACAO_MINIMA_MS);
  });

  it('nunca devolve mais que o máximo', () => {
    expect(duracaoDoPasso({ narracao: 'x'.repeat(500), duracao_ms: 999_999 })).toBe(DURACAO_MAXIMA_MS);
  });
});

describe('progressoDoPasso', () => {
  it('0 no início e 1 no fim', () => {
    expect(progressoDoPasso(0, 3000)).toBe(0);
    expect(progressoDoPasso(3000, 3000)).toBe(1);
  });

  it('meio do caminho', () => {
    expect(progressoDoPasso(1500, 3000)).toBeCloseTo(0.5);
  });

  it('clampa antes de 0 e depois do fim', () => {
    expect(progressoDoPasso(-500, 3000)).toBe(0);
    expect(progressoDoPasso(9000, 3000)).toBe(1);
  });

  it('duração zero devolve 1 (passo sem áudio não trava a animação)', () => {
    expect(progressoDoPasso(0, 0)).toBe(1);
  });
});
```

`test/unit/wav.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { duracaoMsDoWav } from '@/lib/deveres/wav';

// WAV mono 8000 Hz, 8 bits: byteRate 8000. 16000 bytes de dados = 2 s.
function wavMono(sampleRate: number, canais: number, bits: number, bytesDeDados: number): Buffer {
  const byteRate = (sampleRate * canais * bits) / 8;
  const cabecalho = Buffer.alloc(44);
  cabecalho.write('RIFF', 0);
  cabecalho.writeUInt32LE(36 + bytesDeDados, 4);
  cabecalho.write('WAVE', 8);
  cabecalho.write('fmt ', 12);
  cabecalho.writeUInt32LE(16, 16);
  cabecalho.writeUInt16LE(1, 20);            // PCM
  cabecalho.writeUInt16LE(canais, 22);
  cabecalho.writeUInt32LE(sampleRate, 24);
  cabecalho.writeUInt32LE(byteRate, 28);
  cabecalho.writeUInt16LE((canais * bits) / 8, 32);
  cabecalho.writeUInt16LE(bits, 34);
  cabecalho.write('data', 36);
  cabecalho.writeUInt32LE(bytesDeDados, 40);
  return Buffer.concat([cabecalho, Buffer.alloc(bytesDeDados, 0x80)]);
}

describe('duracaoMsDoWav', () => {
  it('calcula a duração de um WAV mono', () => {
    expect(duracaoMsDoWav(wavMono(8000, 1, 8, 16000))).toBe(2000);
  });

  it('calcula a duração de um WAV estéreo 22050 Hz 16 bits', () => {
    const byteRate = 22050 * 2 * 2; // 88200
    expect(duracaoMsDoWav(wavMono(22050, 2, 16, byteRate))).toBe(1000);
  });

  it('devolve null para buffer que não é WAV', () => {
    expect(duracaoMsDoWav(Buffer.from('não é um wav'))).toBeNull();
  });

  it('devolve null para buffer curto demais', () => {
    expect(duracaoMsDoWav(Buffer.alloc(10))).toBeNull();
  });

  it('ignora chunks extras antes de data', () => {
    const base = wavMono(8000, 1, 8, 8000);
    const chunk = Buffer.alloc(16);
    chunk.write('LIST', 0);
    chunk.writeUInt32LE(8, 4);
    chunk.write('INFO', 8);
    const comChunk = Buffer.concat([base.subarray(0, 36), chunk, base.subarray(36)]);
    expect(duracaoMsDoWav(comChunk)).toBe(1000);
  });
});
```

- [ ] **Step 2: Rodar para confirmar a falha**

Run: `npx vitest run test/unit/timeline.test.ts test/unit/wav.test.ts`
Expected: FAIL, módulos não resolvem.

- [ ] **Step 3: Implementar**

`lib/deveres/timeline.ts`:

```ts
// Fallback quando o áudio não foi sintetizado (Piper ausente no dev). 2,6
// palavras/s é fala pausada de explicação para criança.
export const PALAVRAS_POR_SEGUNDO = 2.6;
export const DURACAO_MINIMA_MS = 1200;
export const DURACAO_MAXIMA_MS = 45_000;

function clamp(v: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, v));
}

export function duracaoDoPasso(passo: { narracao: string; duracao_ms: number | null }): number {
  const estimada = Math.round(
    (passo.narracao.trim().split(/\s+/).filter(Boolean).length / PALAVRAS_POR_SEGUNDO) * 1000,
  );
  return clamp(passo.duracao_ms ?? estimada, DURACAO_MINIMA_MS, DURACAO_MAXIMA_MS);
}

export function progressoDoPasso(decorridoMs: number, duracaoMs: number): number {
  if (duracaoMs <= 0) return 1;
  return clamp(decorridoMs / duracaoMs, 0, 1);
}
```

`lib/deveres/wav.ts`:

```ts
// Lê o cabeçalho RIFF para obter a duração real do áudio. A duração real é o que
// sincroniza o desenho com a voz; estimar por palavras só no fallback.
export function duracaoMsDoWav(buffer: Buffer): number | null {
  if (buffer.length < 44) return null;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (buffer.toString('ascii', 8, 12) !== 'WAVE') return null;

  let byteRate: number | null = null;
  let dataSize: number | null = null;

  // Chunks têm tamanho variável e podem vir em qualquer ordem (Piper emite
  // "LIST" antes de "data"). Percorrer em vez de assumir offset fixo.
  let pos = 12;
  while (pos + 8 <= buffer.length) {
    const id = buffer.toString('ascii', pos, pos + 4);
    const size = buffer.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      // fmt: formato(2) canais(2) amostragem(4) byteRate(4) → byteRate em pos+16.
      byteRate = buffer.readUInt32LE(pos + 16);
    }
    if (id === 'data') dataSize = size;
    // Chunks têm padding para par.
    pos += 8 + size + (size % 2);
  }

  if (!byteRate || dataSize === null) return null;
  return Math.round((dataSize / byteRate) * 1000);
}
```

- [ ] **Step 4: Rodar para confirmar o passo**

Run: `npx vitest run test/unit/timeline.test.ts test/unit/wav.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/deveres/timeline.ts lib/deveres/wav.ts test/unit/timeline.test.ts test/unit/wav.test.ts
git commit -m "feat(deveres): duracao do passo e parser de cabecalho wav"
```

---

## Task 4: Motor da animação (função pura)

**Files:**
- Create: `lib/deveres/animacao.ts`
- Test: `test/unit/animacao.test.ts`

**Interfaces:**
- Consumes: `Cena`, `Primitivo` de `lib/deveres/cena.ts`.
- Produces:
  - `interface PrimitivoAnimada { primitivo: Primitivo; progresso: number }`
  - `function estadoDoPasso(cena: Cena, progresso: number, movimentoReduzido: boolean): PrimitivoAnimada[]`

- [ ] **Step 1: Escrever o teste que falha**

`test/unit/animacao.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { estadoDoPasso } from '@/lib/deveres/animacao';
import type { Cena } from '@/lib/deveres/cena';

function cena(...primitivos: unknown[]): Cena {
  return { fundo: '#FDF6EC', primitivos } as Cena;
}

const textoEm0 = { kind: 'texto', x: 0.1, y: 0.2, valor: 'a', tamanho: 0.1, aparece_em: 0, animacao: 'fade' };
const setaEm50 = { kind: 'seta', x: 0.1, y: 0.2, x2: 0.6, y2: 0.2, cor: '#7C5CFC', aparece_em: 0.5, animacao: 'desenhar' };

describe('estadoDoPasso', () => {
  it('esconde primitiva que ainda não entrou', () => {
    const visiveis = estadoDoPasso(cena(setaEm50), 0.2, false);
    expect(visiveis).toHaveLength(0);
  });

  it('mostra primitiva com aparece_em 0 desde o início', () => {
    const visiveis = estadoDoPasso(cena(textoEm0), 0, false);
    expect(visiveis).toHaveLength(1);
  });

  it('progresso individual progride linearmente nos 40% finais do passo', () => {
    const visiveis = estadoDoPasso(cena(setaEm50), 0.7, false);
    expect(visiveis[0].progresso).toBeCloseTo(0.5);
  });

  it('progresso individual chega a 1 no fim do passo', () => {
    const visiveis = estadoDoPasso(cena(setaEm50), 1, false);
    expect(visiveis[0].progresso).toBe(1);
  });

  it('mantém a ordem das primitivas', () => {
    const visiveis = estadoDoPasso(cena(textoEm0, setaEm50), 1, false);
    expect(visiveis.map(v => v.primitivo.kind)).toEqual(['texto', 'seta']);
  });

  it('com movimento reduzido tudo entra pronto', () => {
    const visiveis = estadoDoPasso(cena(textoEm0, setaEm50), 0, true);
    expect(visiveis).toHaveLength(2);
    expect(visiveis.every(v => v.progresso === 1)).toBe(true);
  });

  it('com movimento reduzido ainda esconde o que não entrou', () => {
    // "entra" = o passo já chegou naquele ponto; progresso 1 só para o que entrou.
    const visiveis = estadoDoPasso(cena(setaEm50), 0.4, true);
    expect(visiveis).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar para confirmar a falha**

Run: `npx vitest run test/unit/animacao.test.ts`
Expected: FAIL, módulo não resolve.

- [ ] **Step 3: Implementar**

`lib/deveres/animacao.ts`:

```ts
import type { Cena, Primitivo } from './cena';

export interface PrimitivoAnimada {
  primitivo: Primitivo;
  progresso: number;
}

// Cada primitiva tem sua animação contida nos JANELA_ANIMACAO finais do passo,
// então duas primitivas com aparece_em próximos não se atropelam.
const JANELA_ANIMACAO = 0.4;

// Função pura: o loop de requestAnimationFrame só a chama e pinta. Isso torna
// "repetir passo" determinístico e o motor testável sem canvas.
export function estadoDoPasso(cena: Cena, progresso: number, movimentoReduzido: boolean): PrimitivoAnimada[] {
  const visiveis: PrimitivoAnimada[] = [];
  for (const primitivo of cena.primitivos) {
    const entrou = progresso >= primitivo.aparece_em;
    if (!entrou) continue;
    if (movimentoReduzido) {
      visiveis.push({ primitivo, progresso: 1 });
      continue;
    }
    const restante = 1 - primitivo.aparece_em;
    const local = restante <= 0
      ? 1
      : (progresso - primitivo.aparece_em) / Math.min(JANELA_ANIMACAO, restante);
    visiveis.push({ primitivo, progresso: Math.min(1, Math.max(0, local)) });
  }
  return visiveis;
}
```

- [ ] **Step 4: Rodar para confirmar o passo**

Run: `npx vitest run test/unit/animacao.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/deveres/animacao.ts test/unit/animacao.test.ts
git commit -m "feat(deveres): motor puro da animacao do canvas"
```

---

## Task 5: Prompts e camada de LLM do dever

**Files:**
- Create: `lib/deveres/prompts.ts`
- Create: `lib/deveres/llm.ts`
- Test: `lib/deveres/llm.test.ts`

**Interfaces:**
- Consumes: `ChatOpenAI` de `@langchain/openai` (mesmas envs `LLM_BASE_URL`/`LLM_MODEL`/`LLM_API_KEY`), `ImagemProcessada` de `lib/llm.ts`, `StoryboardSchema`/`PassoSchema`/`sanitizarStoryboard`/`MAX_PASSOS` de `lib/deveres/cena.ts`.
- Produces:
  - `const FRASE_NEUTRA = 'Vamos praticar isso com os números do seu caderno.'`
  - `interface VazamentoResultado { vaza_resposta: boolean; passo: number; motivo: string }`
  - `async function gerarStoryboard(conteudoTexto: string, imagens: ImagemProcessada[]): Promise<Storyboard>`
  - `async function revisarVazamento(storyboard: Storyboard): Promise<VazamentoResultado>`
  - `async function gerarStoryboardSeguro(conteudoTexto: string, imagens: ImagemProcessada[]): Promise<{ storyboard: Storyboard; vazamentoNaoCorrigido: boolean }>`
  - `function aplicarNarracaoNeutra(sb: Storyboard, ordem: number): Storyboard`

- [ ] **Step 1: Escrever o teste que falha**

`lib/deveres/llm.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FRASE_NEUTRA, gerarStoryboardSeguro, aplicarNarracaoNeutra } from './llm';
import type { Storyboard } from './cena';

// Mock da classe, não da função: llm.ts constrói `new ChatOpenAI(...)` no módulo.
const { invokeStructured, invokePlain, ctor } = vi.hoisted(() => ({
  invokeStructured: vi.fn(),
  invokePlain: vi.fn(),
  ctor: vi.fn(),
}));

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: class {
    constructor(opts: unknown) { ctor(opts); }
    withStructuredOutput() { return { invoke: invokeStructured }; }
    invoke() { return invokePlain(); }
  },
}));

function storyboardValido(passos = 3): Storyboard {
  return {
    titulo: 'Soma com barras',
    disciplina: 'Matemática',
    resumo_para_pais: 'A Lia explica o método das barras.',
    passos: Array.from({ length: passos }, (_, i) => ({
      titulo: `Passo ${i + 1}`,
      narracao: 'Vamos entender o que a questão pede.',
      cena: { fundo: '#FDF6EC', primitivos: [] },
    })),
  } as Storyboard;
}

beforeEach(() => {
  invokeStructured.mockReset();
  invokePlain.mockReset();
});

// A mesma função mockada atende gerar, regenerar e auditar. As chamadas vêm em
// ordem fixa: gerar (1), auditar (2), regenerar (3), auditar (4), ... Cada teste
// enfileira as respostas nessa ordem com mockResolvedValueOnce; a última entra
// como mockResolvedValue para valer nas chamadas restantes.
describe('gerarStoryboardSeguro', () => {
  it('sem vazamento devolve o storyboard intacto', async () => {
    invokeStructured
      .mockResolvedValueOnce(storyboardValido())
      .mockResolvedValue({ vaza_resposta: false, passo: 0, motivo: '' });
    const r = await gerarStoryboardSeguro('dever', []);
    expect(r.storyboard.passos).toHaveLength(3);
    expect(r.vazamentoNaoCorrigido).toBe(false);
  });

  it('vazamento no passo 2 regenera só esse passo', async () => {
    const substituto = {
      titulo: 'Passo 2', narracao: 'Agora separamos as partes.',
      cena: { fundo: '#FDF6EC', primitivos: [] },
    };
    invokeStructured
      .mockResolvedValueOnce(storyboardValido())
      .mockResolvedValueOnce({ vaza_resposta: true, passo: 2, motivo: 'diz o resultado' })
      .mockResolvedValueOnce(substituto)
      .mockResolvedValue({ vaza_resposta: false, passo: 0, motivo: '' });

    const r = await gerarStoryboardSeguro('dever', []);
    expect(r.vazamentoNaoCorrigido).toBe(false);
    expect(r.storyboard.passos[1].narracao).toBe('Agora separamos as partes.');
    expect(r.storyboard.passos[0].narracao).toBe('Vamos entender o que a questão pede.');
  });

  it('após esgotar as tentativas troca a narração pela frase neutra e mantém a cena', async () => {
    const substituto = {
      titulo: 'Passo 1', narracao: 'Continua vazando.',
      cena: { fundo: '#FDF6EC', primitivos: [{ kind: 'circulo', x: 0.5, y: 0.5, r: 0.2, cor: '#7C5CFC' }] },
    };
    invokeStructured
      .mockResolvedValueOnce(storyboardValido())                                  // gerar
      .mockResolvedValueOnce({ vaza_resposta: true, passo: 1, motivo: 'a' })      // auditoria 1
      .mockResolvedValueOnce(substituto)                                          // regenerar 1
      .mockResolvedValueOnce({ vaza_resposta: true, passo: 1, motivo: 'b' })      // auditoria 2
      .mockResolvedValueOnce(substituto)                                          // regenerar 2
      .mockResolvedValue({ vaza_resposta: true, passo: 1, motivo: 'c' });         // auditoria 3

    const r = await gerarStoryboardSeguro('dever', []);
    expect(r.vazamentoNaoCorrigido).toBe(true);
    expect(r.storyboard.passos[0].narracao).toBe(FRASE_NEUTRA);
    // A cena do passo sobrevive à degradação: o desenho continua ensinando.
    expect(r.storyboard.passos[0].cena.primitivos).toHaveLength(1);
    expect(r.storyboard.passos[1].narracao).not.toBe(FRASE_NEUTRA);
  });

  it('storyboard com passos demais é truncado para MAX_PASSOS', async () => {
    invokeStructured
      .mockResolvedValueOnce(storyboardValido(12))
      .mockResolvedValue({ vaza_resposta: false, passo: 0, motivo: '' });
    const r = await gerarStoryboardSeguro('dever', []);
    expect(r.storyboard.passos).toHaveLength(8);
  });
});

describe('aplicarNarracaoNeutra', () => {
  it('substitui só o passo indicado', () => {
    const sb = storyboardValido(3);
    const r = aplicarNarracaoNeutra(sb, 2);
    expect(r.passos[1].narracao).toBe(FRASE_NEUTRA);
    expect(r.passos[0].narracao).not.toBe(FRASE_NEUTRA);
  });

  it('passo fora do intervalo deixa o storyboard intacto', () => {
    const sb = storyboardValido(2);
    expect(aplicarNarracaoNeutra(sb, 9).passos[0].narracao).toBe(sb.passos[0].narracao);
  });
});
```

- [ ] **Step 2: Rodar para confirmar a falha**

Run: `npx vitest run lib/deveres/llm.test.ts`
Expected: FAIL, módulo não resolve.

- [ ] **Step 3: Escrever os prompts**

`lib/deveres/prompts.ts`:

```ts
export const PROMPT_STORYBOARD = `Você é a Lia, explicadora de crianças de 8 a 14 anos (3º ao 8º ano do Brasil).

A imagem mostra o dever de casa de uma criança. Explique o dever para que ela consiga fazê-lo sozinha.

REGRA INEGOCIÁVEL: nunca diga o resultado do exercício que aparece na imagem. Nem o número, nem a palavra, nem "a resposta é". Explique o conceito, o método passo a passo e, se precisar de exemplo numérico, use números DIFERENTES dos do dever.

Devolva um plano com 3 a 8 passos. Cada passo tem:
- titulo: no máximo 4 palavras, em português.
- narracao: 2 a 5 frases faladas em voz alta. Frases curtas. Sem lista, sem markdown, sem emoji.
- cena: o desenho que aparece enquanto a narração roda.

A cena usa primitivas com coordenadas NORMALIZADAS de 0 a 1 (x e y; 0 é canto superior esquerdo). Tipos permitidos:
- retangulo { x, y, w, h, cor, raio }
- circulo { x, y, r, cor }
- linha { x, y, x2, y2, cor, espessura }
- seta { x, y, x2, y2, cor, espessura }
- texto { x, y, valor, tamanho, cor, alinhamento } — valor com no máximo 30 caracteres
- emoji { x, y, valor, tamanho }
- reta_numerica { x, y, w, minimo, maximo, marcas[], destaque, rotulo, cor }
- barra_modelo { x, y, w, h, partes[{valor, rotulo, cor}] } — barras proporcionais ao valor
- balanca { x, y, w, prato_esquerdo[], prato_direito[], inclinacao, cor }
- blocos { x, y, colunas, itens, tipo, cor } — contagem e agrupamento
- destaque { x, y, w, h } — pulso sobre uma região já desenhada

Toda primitiva leva aparece_em (0 a 1: em que fração do passo ela entra) e animacao ("fade", "desenhar", "crescer" ou "pular"). Espalhe aparece_em entre 0 e 0.6 para o desenho acompanhar a fala. Cores em hexadecimal.

Escolha a primitiva pelo conteúdo: contagem usa blocos; fração e partes-do-todo usam barra_modelo; igualdade e equação usam balanca; ordem e comparação usam reta_numerica.

No máximo 24 primitivas por cena. O texto na tela é apoio: a explicação de verdade está na narracao.`;

export const PROMPT_REGENERAR_PASSO = `A auditoria disse que este passo da explicadora está revelando a resposta do dever de casa.

Motivo apontado: {{MOTIVO}}

Reescreva o passo {{ORDEM}} explicando o mesmo conceito sem enunciar nenhum resultado do exercício. Se precisar de exemplo, use números diferentes dos do dever.

Devolva o passo completo (titulo, narracao, cena).`;

export const PROMPT_AUDITORIA = `Você audita a explicação de um dever de casa para crianças.

Responda se a explicação, em qualquer passo, revela a resposta do exercício fotografado: um número, uma palavra, uma conta resolvida ou um resultado que a criança só precisaria copiar.

Devolva:
- vaza_resposta: true ou false
- passo: o número de ordem do passo problemático (1 é o primeiro); 0 se não vaza
- motivo: uma frase explicando; vazio se não vaza

Revelar o MÉTODO não é vazamento. Revelar o RESULTADO é.`;

export const PROMPT_CONTEXTO_DEVER = `Dever de casa a explicar (conteúdo extraído dos arquivos enviados pelo responsável):\n\n{{CONTEUDO}}`;
```

- [ ] **Step 4: Implementar a camada de LLM**

`lib/deveres/llm.ts`:

```ts
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { ImagemProcessada } from '../llm';
import {
  PassoSchema, StoryboardSchema, Storyboard, sanitizarStoryboard,
} from './cena';
import {
  PROMPT_AUDITORIA, PROMPT_CONTEXTO_DEVER, PROMPT_REGENERAR_PASSO, PROMPT_STORYBOARD,
} from './prompts';

const LLM_BASE_URL = process.env.LLM_BASE_URL || 'http://192.168.18.4:1234/v1';
const LLM_MODEL = process.env.LLM_MODEL || 'local-model';
const LLM_API_KEY = process.env.LLM_API_KEY || 'local';

const MAX_TENTATIVAS_LLM = 3;
const MAX_TENTATIVAS_VAZAMENTO = 2;

export const FRASE_NEUTRA = 'Vamos praticar isso com os números do seu caderno.';

const llm = new ChatOpenAI({
  model: LLM_MODEL,
  apiKey: LLM_API_KEY,
  configuration: { baseURL: LLM_BASE_URL },
});

const VazamentoSchema = z.object({
  vaza_resposta: z.boolean(),
  passo: z.number().int().default(0),
  motivo: z.string().default(''),
});

export interface VazamentoResultado {
  vaza_resposta: boolean;
  passo: number;
  motivo: string;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function comRetry<T>(executar: () => Promise<T>): Promise<T> {
  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS_LLM; tentativa++) {
    try {
      return await executar();
    } catch (e) {
      ultimoErro = e;
      if (tentativa < MAX_TENTATIVAS_LLM - 1) await esperar(500 * (tentativa + 1));
    }
  }
  throw ultimoErro;
}

function conteudoDoUsuario(conteudoTexto: string, imagens: ImagemProcessada[]): any[] {
  const partes: any[] = [];
  if (conteudoTexto.trim()) {
    partes.push({ type: 'text', text: PROMPT_CONTEXTO_DEVER.replace('{{CONTEUDO}}', conteudoTexto) });
  }
  for (const img of imagens) {
    partes.push({ type: 'image_url', image_url: { url: `data:${img.mime};base64,${img.base64}` } });
  }
  return partes;
}

export async function gerarStoryboard(conteudoTexto: string, imagens: ImagemProcessada[]): Promise<Storyboard> {
  const alvo = llm.withStructuredOutput(StoryboardSchema, { name: 'gerar_storyboard' });
  const messages = [
    { role: 'system', content: PROMPT_STORYBOARD },
    { role: 'user', content: conteudoDoUsuario(conteudoTexto, imagens) },
  ];

  for (let tentativa = 0; tentativa < MAX_TENTATIVAS_LLM; tentativa++) {
    const sb = await comRetry(() => alvo.invoke(messages as any)) as Storyboard;
    if (Array.isArray(sb?.passos) && sb.passos.length > 0) return sanitizarStoryboard(sb);
  }
  throw new Error('A explicadora não devolveu nenhum passo.');
}

async function regenerarPasso(
  sb: Storyboard, ordem: number, conteudoTexto: string, imagens: ImagemProcessada[], motivo: string,
): Promise<Storyboard> {
  const alvo = llm.withStructuredOutput(PassoSchema, { name: 'regenerar_passo' });
  const prompt = PROMPT_REGENERAR_PASSO
    .replace('{{MOTIVO}}', motivo || 'revela o resultado')
    .replace('{{ORDEM}}', String(ordem));

  const messages = [
    { role: 'system', content: PROMPT_STORYBOARD },
    { role: 'user', content: [...conteudoDoUsuario(conteudoTexto, imagens), { type: 'text', text: prompt }] },
  ];

  const novo = await comRetry(() => alvo.invoke(messages as any));
  const passos = sb.passos.slice();
  // A auditoria numera a partir de 1; o array é 0-based.
  passos[ordem - 1] = novo;
  return { ...sb, passos };
}

export async function revisarVazamento(storyboard: Storyboard): Promise<VazamentoResultado> {
  const alvo = llm.withStructuredOutput(VazamentoSchema, { name: 'auditar_vazamento' });
  const explicacao = storyboard.passos
    .map((p, i) => `${i + 1}. ${p.titulo}: ${p.narracao}`).join('\n');
  const messages = [
    { role: 'system', content: PROMPT_AUDITORIA },
    { role: 'user', content: explicacao },
  ];
  return await comRetry(() => alvo.invoke(messages as any));
}

export function aplicarNarracaoNeutra(sb: Storyboard, ordem: number): Storyboard {
  if (ordem < 1 || ordem > sb.passos.length) return sb;
  const passos = sb.passos.slice();
  passos[ordem - 1] = { ...passos[ordem - 1], narracao: FRASE_NEUTRA };
  return { ...sb, passos };
}

// Duas camadas (spec §4.2): o prompt pede, a auditoria verifica. O laço alterna
// auditoria e regeneração até MAX_TENTATIVAS_VAZAMENTO regenerações. Se ainda
// vazar, degrada: mantém o desenho e troca a fala pela frase fixa, em vez de
// descartar o dever que o pai pagou para criar.
export async function gerarStoryboardSeguro(
  conteudoTexto: string, imagens: ImagemProcessada[],
): Promise<{ storyboard: Storyboard; vazamentoNaoCorrigido: boolean }> {
  let storyboard = await gerarStoryboard(conteudoTexto, imagens);

  for (let tentativa = 0; tentativa <= MAX_TENTATIVAS_VAZAMENTO; tentativa++) {
    const auditoria = await revisarVazamento(storyboard);
    if (!auditoria.vaza_resposta || auditoria.passo < 1) {
      return { storyboard: sanitizarStoryboard(storyboard), vazamentoNaoCorrigido: false };
    }

    if (tentativa === MAX_TENTATIVAS_VAZAMENTO) {
      console.warn(`[deveres] vazamento não corrigido no passo ${auditoria.passo}: ${auditoria.motivo}`);
      return {
        storyboard: sanitizarStoryboard(aplicarNarracaoNeutra(storyboard, auditoria.passo)),
        vazamentoNaoCorrigido: true,
      };
    }

    storyboard = await regenerarPasso(storyboard, auditoria.passo, conteudoTexto, imagens, auditoria.motivo);
  }

  // Inalcançável: o laço sempre retorna dentro do limite.
  return { storyboard: sanitizarStoryboard(storyboard), vazamentoNaoCorrigido: false };
}
```

- [ ] **Step 5: Estender o script de teste de LLM**

O script atual (`"test:llm": "vitest run lib/llm.test.ts"`) não alcança `lib/deveres/`. Em `package.json`, substituir por:

```json
"test:llm": "vitest run lib/llm.test.ts lib/deveres/llm.test.ts",
```

- [ ] **Step 6: Rodar para confirmar o passo**

Run: `npx vitest run lib/deveres/llm.test.ts`
Expected: PASS (6 testes).

Run: `npm run test:llm`
Expected: roda os dois arquivos de integração de LLM (o de revisões exige o servidor local de pé; se ele estiver desligado, esse arquivo falha por timeout, o que é o comportamento atual do repo).

- [ ] **Step 7: Commit**

```bash
git add lib/deveres/prompts.ts lib/deveres/llm.ts lib/deveres/llm.test.ts package.json
git commit -m "feat(deveres): geracao de storyboard com auditoria de vazamento"
```

---

## Task 6: Síntese de áudio local com Piper

**Files:**
- Create: `lib/deveres/piper.ts`
- Modify: `.env.example`
- Test: `test/unit/piper.test.ts`

**Interfaces:**
- Consumes: `duracaoMsDoWav` de `lib/deveres/wav.ts`.
- Produces:
  - `interface AudioPasso { ordem: number; caminho: string; duracao_ms: number | null }`
  - `function caminhoDoAudio(deverId: string, ordem: number): string` (caminho relativo ao `process.cwd()`)
  - `function piperDisponivel(): boolean`
  - `async function sintetizarPassos(deverId: string, passos: { ordem: number; narracao: string }[]): Promise<AudioPasso[]>`

- [ ] **Step 1: Escrever o teste que falha**

`test/unit/piper.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';

// execFile é mockado na convenção de callback, então o promisify real de
// node:util continua em uso (mockar node:util afetaria todo o processo de teste).
const { execFile, existsSync, readFile, mkdir } = vi.hoisted(() => ({
  execFile: vi.fn(),
  existsSync: vi.fn(() => true),
  readFile: vi.fn(),
  mkdir: vi.fn(async () => {}),
}));

vi.mock('node:child_process', () => ({ execFile }));
vi.mock('node:fs', () => ({ existsSync, promises: { mkdir, readFile } }));

import { caminhoDoAudio, piperDisponivel, sintetizarPassos } from '@/lib/deveres/piper';

// WAV mono 8000 Hz 8 bits: byteRate 8000, 16000 bytes de dados = 2 s.
function wavDe2s(): Buffer {
  const cabecalho = Buffer.alloc(44);
  cabecalho.write('RIFF', 0);
  cabecalho.writeUInt32LE(36 + 16000, 4);
  cabecalho.write('WAVE', 8);
  cabecalho.write('fmt ', 12);
  cabecalho.writeUInt32LE(16, 16);
  cabecalho.writeUInt16LE(1, 20);
  cabecalho.writeUInt16LE(1, 22);
  cabecalho.writeUInt32LE(8000, 24);
  cabecalho.writeUInt32LE(8000, 28);
  cabecalho.writeUInt16LE(1, 32);
  cabecalho.writeUInt16LE(8, 34);
  cabecalho.write('data', 36);
  cabecalho.writeUInt32LE(16000, 40);
  return Buffer.concat([cabecalho, Buffer.alloc(16000, 0x80)]);
}

const sucesso = () => execFile.mockImplementation((_b: string, _a: string[], _o: unknown, cb: (e: null) => void) => cb(null));

beforeEach(() => {
  execFile.mockReset();
  readFile.mockReset();
  mkdir.mockClear();
  existsSync.mockReturnValue(true);
  readFile.mockResolvedValue(wavDe2s());
  process.env.PIPER_BIN = '/opt/piper/piper';
  process.env.PIPER_MODEL = '/opt/piper/pt_BR-faber-medium.onnx';
});

afterEach(() => {
  delete process.env.PIPER_BIN;
  delete process.env.PIPER_MODEL;
});

describe('piperDisponivel', () => {
  it('true com bin e modelo configurados', () => {
    expect(piperDisponivel()).toBe(true);
  });

  it('false sem PIPER_BIN', () => {
    delete process.env.PIPER_BIN;
    expect(piperDisponivel()).toBe(false);
  });

  it('false sem PIPER_MODEL', () => {
    delete process.env.PIPER_MODEL;
    expect(piperDisponivel()).toBe(false);
  });

  it('false quando o binário não existe no disco', () => {
    existsSync.mockReturnValue(false);
    expect(piperDisponivel()).toBe(false);
  });
});

describe('caminhoDoAudio', () => {
  it('fica em uploads/deveres/<id>/<ordem>.wav', () => {
    const p = caminhoDoAudio('abc', 3);
    expect(p.endsWith(path.join('uploads', 'deveres', 'abc', '3.wav'))).toBe(true);
  });
});

describe('sintetizarPassos', () => {
  it('sem Piper configurado devolve passos sem áudio', async () => {
    delete process.env.PIPER_BIN;
    const r = await sintetizarPassos('abc', [{ ordem: 1, narracao: 'oi' }]);
    expect(r).toEqual([{ ordem: 1, caminho: '', duracao_ms: null }]);
    expect(execFile).not.toHaveBeenCalled();
  });

  it('chama o Piper uma vez por passo e devolve a duração lida do WAV', async () => {
    sucesso();
    const r = await sintetizarPassos('abc', [
      { ordem: 1, narracao: 'primeiro' },
      { ordem: 2, narracao: 'segundo' },
    ]);
    expect(execFile).toHaveBeenCalledTimes(2);
    expect(r[0].duracao_ms).toBe(2000);
    expect(r[1].caminho).toContain(path.join('2.wav'));
  });

  it('falha de um passo não derruba os demais', async () => {
    execFile.mockImplementationOnce((_b: string, _a: string[], _o: unknown, cb: (e: Error) => void) =>
      cb(new Error('piper caiu')));
    sucesso();
    const r = await sintetizarPassos('abc', [
      { ordem: 1, narracao: 'primeiro' },
      { ordem: 2, narracao: 'segundo' },
    ]);
    expect(r[0].duracao_ms).toBeNull();
    expect(r[0].caminho).toBe('');
    expect(r[1].duracao_ms).toBe(2000);
    expect(r[1].caminho).toContain(path.join('2.wav'));
  });
});
```

- [ ] **Step 2: Rodar para confirmar a falha**

Run: `npx vitest run test/unit/piper.test.ts`
Expected: FAIL, módulo não resolve.

- [ ] **Step 3: Implementar**

`lib/deveres/piper.ts`:

```ts
import { execFile } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { duracaoMsDoWav } from './wav';

const executar = promisify(execFile);

export interface AudioPasso {
  ordem: number;
  caminho: string;
  duracao_ms: number | null;
}

// Relativo a process.cwd(), o mesmo critério de uploads/ em app/api/revisao/route.ts.
// Fica fora de public/ de propósito: public/ é servido sem autenticação.
export function caminhoDoAudio(deverId: string, ordem: number): string {
  return path.join('uploads', 'deveres', deverId, `${ordem}.wav`);
}

export function piperDisponivel(): boolean {
  const bin = process.env.PIPER_BIN;
  const modelo = process.env.PIPER_MODEL;
  if (!bin || !modelo) return false;
  return existsSync(bin) && existsSync(modelo);
}

// Piper escreve no CWD quando --output_file é relativo: usar caminho absoluto.
async function sintetizarUm(narracao: string, destinoAbsoluto: string): Promise<void> {
  await executar(process.env.PIPER_BIN as string, [
    '--model', process.env.PIPER_MODEL as string,
    '--output_file', destinoAbsoluto,
  ], { input: narracao, timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
}

// Áudio é gerado na criação, uma vez (spec §3.3): a animação usa a duração real e
// o replay é instantâneo. Piper ausente não bloqueia a feature: o passo fica sem
// áudio e o cliente cai no fallback de duração por palavras.
export async function sintetizarPassos(
  deverId: string,
  passos: { ordem: number; narracao: string }[],
): Promise<AudioPasso[]> {
  if (!piperDisponivel()) {
    console.warn('[deveres] Piper não configurado (PIPER_BIN/PIPER_MODEL): dever criado sem áudio.');
    return passos.map((p) => ({ ordem: p.ordem, caminho: '', duracao_ms: null }));
  }

  const pasta = path.join(process.cwd(), 'uploads', 'deveres', deverId);
  await fs.mkdir(pasta, { recursive: true });

  const resultados: AudioPasso[] = [];
  for (const passo of passos) {
    const relativo = caminhoDoAudio(deverId, passo.ordem);
    const absoluto = path.join(process.cwd(), relativo);
    try {
      await sintetizarUm(passo.narracao, absoluto);
      const wav = await fs.readFile(absoluto);
      resultados.push({ ordem: passo.ordem, caminho: relativo, duracao_ms: duracaoMsDoWav(wav) });
    } catch (err) {
      // caminho '' marca o passo como sem áudio: a rota grava audio_path nulo e o
      // cliente cai no fallback de duração por palavras. Um passo sem voz não
      // invalida o dever inteiro.
      console.error(`[deveres] áudio do passo ${passo.ordem} falhou:`, (err as Error).message);
      resultados.push({ ordem: passo.ordem, caminho: '', duracao_ms: null });
    }
  }
  return resultados;
}
```

- [ ] **Step 4: Rodar para confirmar o passo**

Run: `npx vitest run test/unit/piper.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Documentar as envs**

Acrescentar ao fim de `.env.example`:

```
# TTS local (Piper). Binário e modelo pt-BR. Sem essas duas variáveis o dever é
# criado sem áudio e a tela da criança usa legendas + duração estimada.
# Modelo recomendado: pt_BR-faber-medium (CPU, ~60 MB).
PIPER_BIN=/caminho/para/piper
PIPER_MODEL=/caminho/para/pt_BR-faber-medium.onnx
```

- [ ] **Step 6: Commit**

```bash
git add lib/deveres/piper.ts test/unit/piper.test.ts .env.example
git commit -m "feat(deveres): sintese local de audio com piper"
```

---

## Task 7: Tipos e repositório de deveres

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/repos/deveres.ts`
- Test: `test/db/deveres.test.ts`

**Interfaces:**
- Consumes: `getPool` de `lib/db/pool.ts`, `PoolClient`/`Pool` de `pg`, tipos de `lib/types.ts`.
- Produces:
  - `interface Dever { id, conta_id, titulo, disciplina, serie_ano, conteudo_texto, resumo_para_pais, chave_idempotencia, criado_em }`
  - `interface DeverPasso { id, dever_id, ordem, titulo, narracao, cena, audio_path, duracao_ms }`
  - `interface ResumoDever extends Dever { total_passos: number }`
  - `interface DeverCompleto { dever: Dever; passos: DeverPasso[] }`
  - `async function criarDever(client, contaId, dados: { titulo: string | null; disciplina: string | null; conteudo_texto: string; resumo_para_pais: string | null; chaveIdempotencia?: string | null }): Promise<string>`
  - `async function criarPassos(client, deverId, passos: { ordem: number; titulo: string; narracao: string; cena: unknown; audio_path: string | null; duracao_ms: number | null }[]): Promise<void>`
  - `async function getDeverPorChave(client, contaId, chave): Promise<Dever | null>`
  - `async function getDever(id, contaId): Promise<Dever | null>`
  - `async function listarDeveresComResumo(contaId): Promise<ResumoDever[]>`
  - `async function getPassos(deverId): Promise<DeverPasso[]>`

- [ ] **Step 1: Escrever o teste que falha**

`test/db/deveres.test.ts`:

```ts
// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { pool, prepararBanco, limparTabelas } from './helper';
import { createConta } from '../../lib/repos/contas';
import {
  criarDever, criarPassos, getDever, getDeverPorChave, getPassos, listarDeveresComResumo,
} from '../../lib/repos/deveres';

beforeAll(async () => { await prepararBanco(); });
afterEach(async () => { await limparTabelas(); });
afterAll(async () => { await pool.end(); });

const cena = { fundo: '#FDF6EC', primitivos: [{ kind: 'texto', x: 0.5, y: 0.5, valor: 'oi', tamanho: 0.1 }] };

test('criarDever + criarPassos grava e relê na ordem', async () => {
  const conta = await createConta('Ana', 'Souza', 'ana@example.com', 'hash', 3);
  const id = await criarDever(pool, conta.id, {
    titulo: 'Soma com barras', disciplina: 'Matemática',
    conteudo_texto: 'conteúdo', resumo_para_pais: 'resumo',
  });
  await criarPassos(pool, id, [
    { ordem: 1, titulo: 'Primeiro', narracao: 'a', cena, audio_path: null, duracao_ms: 2000 },
    { ordem: 2, titulo: 'Depois', narracao: 'b', cena, audio_path: 'uploads/deveres/x/2.wav', duracao_ms: 3000 },
  ]);

  const passos = await getPassos(id);
  expect(passos.map(p => p.titulo)).toEqual(['Primeiro', 'Depois']);
  expect(passos[1].audio_path).toBe('uploads/deveres/x/2.wav');
  expect(passos[0].cena).toEqual(cena);
});

test('getDever respeita a posse', async () => {
  const a = await createConta('Ana', 'S', 'ana2@example.com', 'hash', 3);
  const b = await createConta('Bob', 'T', 'bob2@example.com', 'hash', 3);
  const id = await criarDever(pool, a.id, {
    titulo: null, disciplina: null, conteudo_texto: 'x', resumo_para_pais: null,
  });
  expect(await getDever(id, a.id)).not.toBeNull();
  expect(await getDever(id, b.id)).toBeNull();
});

test('getDeverPorChave acha o dever da tentativa', async () => {
  const conta = await createConta('Ana', 'S', 'ana3@example.com', 'hash', 3);
  const id = await criarDever(pool, conta.id, {
    titulo: null, disciplina: null, conteudo_texto: 'x', resumo_para_pais: null,
    chaveIdempotencia: 'chave-abc',
  });
  const achado = await getDeverPorChave(pool, conta.id, 'chave-abc');
  expect(achado?.id).toBe(id);
  expect(await getDeverPorChave(pool, conta.id, 'outra')).toBeNull();
});

test('listarDeveresComResumo traz a contagem de passos', async () => {
  const conta = await createConta('Ana', 'S', 'ana4@example.com', 'hash', 3);
  const id = await criarDever(pool, conta.id, {
    titulo: 'T', disciplina: 'Matemática', conteudo_texto: 'x', resumo_para_pais: null,
  });
  await criarPassos(pool, id, [
    { ordem: 1, titulo: 'a', narracao: 'a', cena, audio_path: null, duracao_ms: null },
    { ordem: 2, titulo: 'b', narracao: 'b', cena, audio_path: null, duracao_ms: null },
  ]);
  const lista = await listarDeveresComResumo(conta.id);
  expect(lista).toHaveLength(1);
  expect(lista[0].total_passos).toBe(2);
  expect(lista[0].disciplina).toBe('Matemática');
});

test('dois deveres sem chave coexistem', async () => {
  const conta = await createConta('Ana', 'S', 'ana5@example.com', 'hash', 3);
  await criarDever(pool, conta.id, { titulo: null, disciplina: null, conteudo_texto: 'a', resumo_para_pais: null });
  await criarDever(pool, conta.id, { titulo: null, disciplina: null, conteudo_texto: 'b', resumo_para_pais: null });
  expect(await listarDeveresComResumo(conta.id)).toHaveLength(2);
});
```

- [ ] **Step 2: Rodar para confirmar a falha**

Run: `npm run test:db -- test/db/deveres.test.ts`
Expected: FAIL, módulo não resolve.

- [ ] **Step 3: Acrescentar os tipos**

Acrescentar ao fim de `lib/types.ts`:

```ts
export interface Dever {
  id: string;
  conta_id: string;
  titulo: string | null;
  disciplina: string | null;
  serie_ano: string;
  conteudo_texto: string;
  resumo_para_pais: string | null;
  chave_idempotencia?: string | null;
  criado_em: string;
}

export interface DeverPasso {
  id: number;
  dever_id: string;
  ordem: number;
  titulo: string;
  narracao: string;
  cena: unknown;
  audio_path: string | null;
  duracao_ms: number | null;
}

export interface ResumoDever extends Dever {
  total_passos: number;
}

export interface DeverCompleto {
  dever: Dever;
  passos: DeverPasso[];
}

export interface PassoInput {
  ordem: number;
  titulo: string;
  narracao: string;
  cena: unknown;
  audio_path: string | null;
  duracao_ms: number | null;
}
```

- [ ] **Step 4: Implementar o repositório**

`lib/repos/deveres.ts`:

```ts
import { Pool, PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { Dever, DeverPasso, PassoInput, ResumoDever } from '../types';

export async function criarDever(
  client: PoolClient | Pool,
  contaId: string,
  dados: {
    titulo: string | null;
    disciplina: string | null;
    conteudo_texto: string;
    resumo_para_pais: string | null;
    chaveIdempotencia?: string | null;
  },
): Promise<string> {
  const { rows } = await client.query(
    `INSERT INTO deveres (conta_id, titulo, disciplina, conteudo_texto, resumo_para_pais, chave_idempotencia)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [contaId, dados.titulo, dados.disciplina, dados.conteudo_texto, dados.resumo_para_pais,
     dados.chaveIdempotencia ?? null],
  );
  return rows[0].id as string;
}

export async function criarPassos(
  client: PoolClient | Pool, deverId: string, passos: PassoInput[],
): Promise<void> {
  for (const p of passos) {
    await client.query(
      `INSERT INTO dever_passos (dever_id, ordem, titulo, narracao, cena, audio_path, duracao_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      // Mesmo tratamento de questoes.opcoes: pg serializa array JS como literal de
      // array, que não é JSON válido para jsonb. Entrar como texto JSON.
      [deverId, p.ordem, p.titulo, p.narracao, JSON.stringify(p.cena), p.audio_path, p.duracao_ms],
    );
  }
}

export async function getDeverPorChave(
  client: PoolClient | Pool, contaId: string, chave: string,
): Promise<Dever | null> {
  const { rows } = await client.query(
    `SELECT id, conta_id, titulo, disciplina, serie_ano, conteudo_texto, resumo_para_pais,
            chave_idempotencia, criado_em
     FROM deveres WHERE conta_id = $1 AND chave_idempotencia = $2`,
    [contaId, chave],
  );
  return (rows[0] as Dever) ?? null;
}

export async function getDever(id: string, contaId: string): Promise<Dever | null> {
  const { rows } = await getPool().query(
    `SELECT id, conta_id, titulo, disciplina, serie_ano, conteudo_texto, resumo_para_pais,
            chave_idempotencia, criado_em
     FROM deveres WHERE id = $1 AND conta_id = $2`,
    [id, contaId],
  );
  return (rows[0] as Dever) ?? null;
}

// Um GROUP BY com LEFT JOIN dá a contagem de passos sem consultar tabela por
// tabela (mesmo padrão de listarRevisoesComResumo).
export async function listarDeveresComResumo(contaId: string): Promise<ResumoDever[]> {
  const { rows } = await getPool().query(
    `SELECT d.id, d.conta_id, d.titulo, d.disciplina, d.serie_ano, d.conteudo_texto,
            d.resumo_para_pais, d.chave_idempotencia, d.criado_em,
            COUNT(p.id)::int AS total_passos
     FROM deveres d
     LEFT JOIN dever_passos p ON p.dever_id = d.id
     WHERE d.conta_id = $1
     GROUP BY d.id
     ORDER BY d.criado_em DESC`,
    [contaId],
  );
  return rows as ResumoDever[];
}

export async function getPassos(deverId: string): Promise<DeverPasso[]> {
  const { rows } = await getPool().query(
    `SELECT id, dever_id, ordem, titulo, narracao, cena, audio_path, duracao_ms
     FROM dever_passos WHERE dever_id = $1 ORDER BY ordem`,
    [deverId],
  );
  return rows as DeverPasso[];
}
```

- [ ] **Step 5: Rodar para confirmar o passo**

Run: `npm run test:db -- test/db/deveres.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/repos/deveres.ts test/db/deveres.test.ts
git commit -m "feat(deveres): tipos e repositorio de deveres e passos"
```

---

## Task 8: Vínculo do movimento de saldo ao dever

**Files:**
- Modify: `lib/repos/movimentos.ts`
- Test: `test/db/deveres.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `PoolClient` de `pg`.
- Produces:
  - `async function vincularMovimentoADever(client: PoolClient, contaId: string, deverId: string): Promise<void>`
  - `extratoConta` passa a devolver também `dever_id`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `test/db/deveres.test.ts` (importar `comTransacao` de `../../lib/repos/transacao`, `consumirSaldo` de `../../lib/quota` e `vincularMovimentoADever` de `../../lib/repos/movimentos`):

```ts
test('vincularMovimentoADever liga o consumo ao dever', async () => {
  const conta = await createConta('Ana', 'S', 'ana6@example.com', 'hash', 3);
  await comTransacao(async (client) => {
    const saldo = await consumirSaldo(client, conta.id);
    expect(saldo).toBe(2);
    const id = await criarDever(client, conta.id, {
      titulo: null, disciplina: null, conteudo_texto: 'x', resumo_para_pais: null,
    });
    await vincularMovimentoADever(client, conta.id, id);
  });

  const { rows } = await pool.query(
    'SELECT tipo, quantidade, dever_id, revisao_id FROM movimentos_saldo WHERE conta_id = $1',
    [conta.id],
  );
  expect(rows[0].quantidade).toBe(-1);
  expect(rows[0].revisao_id).toBeNull();
  expect(rows[0].dever_id).toBeTruthy();
});
```

- [ ] **Step 2: Rodar para confirmar a falha**

Run: `npm run test:db -- test/db/deveres.test.ts`
Expected: FAIL, `vincularMovimentoADever is not a function`.

- [ ] **Step 3: Implementar**

Em `lib/repos/movimentos.ts`, acrescentar depois de `vincularMovimentoARevisao`:

```ts
// Igual ao vínculo da revisão: consumirSaldo insere o movimento sem referência e
// o vínculo acontece depois que o dever existe.
export async function vincularMovimentoADever(
  client: PoolClient, contaId: string, deverId: string,
): Promise<void> {
  await client.query(
    `UPDATE movimentos_saldo SET dever_id = $1
     WHERE conta_id = $2 AND tipo = $3 AND dever_id IS NULL AND revisao_id IS NULL`,
    [deverId, contaId, 'consumo'],
  );
}
```

E substituir o SELECT de `extratoConta` por:

```ts
export function extratoConta(contaId: string) {
  return getPool().query(
    `SELECT m.tipo, m.quantidade, m.token_id, m.revisao_id, m.dever_id, t.plano_codigo, m.criado_em
     FROM movimentos_saldo m
     LEFT JOIN tokens t ON t.id = m.token_id
     WHERE m.conta_id = $1 ORDER BY m.criado_em DESC`,
    [contaId],
  );
}
```

- [ ] **Step 4: Rodar os testes de banco completos**

Run: `npm run test:db`
Expected: PASS. Se `test/db/admin.test.ts` ou um teste de `/creditos` assertar a lista exata de colunas do extrato, atualizar a expectativa para incluir `dever_id` (valor `null` em movimentos de revisão).

- [ ] **Step 5: Commit**

```bash
git add lib/repos/movimentos.ts test/db/deveres.test.ts
git commit -m "feat(deveres): vinculo do movimento de saldo ao dever"
```

---

## Task 9: Rota POST /api/dever

**Files:**
- Create: `app/api/dever/route.ts`
- Test: `test/db/dever-route.test.ts`

**Interfaces:**
- Consumes: `autenticar`/`naoAutorizado` de `lib/auth/guard`; `comTransacao`; `consumirSaldo`; `criarDever`/`criarPassos`/`getDeverPorChave` de `lib/repos/deveres`; `vincularMovimentoADever`; `gerarStoryboardSeguro` de `lib/deveres/llm`; `sintetizarPassos` de `lib/deveres/piper`; `processarImagem`; `extrairTextoPDF`; `MAX_IMAGENS`.
- Produces: `POST` respondendo `{ id, saldo, duplicate? }` (200), `{ error }` (400/401/402/500).

- [ ] **Step 1: Escrever o teste que falha**

`test/db/dever-route.test.ts`:

```ts
// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { pool, prepararBanco, limparTabelas } from './helper';
import { POST as criarDever } from '../../app/api/dever/route';
import { createConta } from '../../lib/repos/contas';
import { assinarToken } from '../../lib/auth/jwt';

process.env.JWT_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres';

// Mock pelos mesmos specifiers que a rota importa, senão o alias do vitest
// resolve dois módulos e o mock não pega (mesmo motivo de revisao-route.test.ts).
const { gerarStoryboardSeguro, sintetizarPassos } = vi.hoisted(() => ({
  gerarStoryboardSeguro: vi.fn(),
  sintetizarPassos: vi.fn(),
}));
vi.mock('@/lib/deveres/llm', () => ({ gerarStoryboardSeguro }));
vi.mock('@/lib/deveres/piper', () => ({ sintetizarPassos }));

const cena = { fundo: '#FDF6EC', primitivos: [] };
const storyboardFixo = {
  titulo: 'Soma com barras',
  disciplina: 'Matemática',
  resumo_para_pais: 'A Lia explica o método.',
  passos: [
    { titulo: 'Primeiro', narracao: 'a', cena },
    { titulo: 'Depois', narracao: 'b', cena },
  ],
};

beforeAll(async () => { await prepararBanco(); });
beforeEach(() => {
  gerarStoryboardSeguro.mockReset();
  gerarStoryboardSeguro.mockImplementation(async () => ({ storyboard: storyboardFixo, vazamentosCorrigidos: 0 }));
  sintetizarPassos.mockReset();
  sintetizarPassos.mockImplementation(async (deverId: string, passos: { ordem: number }[]) =>
    passos.map((p) => ({ ordem: p.ordem, caminho: `uploads/deveres/${deverId}/${p.ordem}.wav`, duracao_ms: 2000 })));
});
afterEach(async () => { await limparTabelas(); });
afterAll(async () => { await pool.end(); });

const post = (contaId: string, chave?: string) => {
  const form = new FormData();
  form.set('texto', 'dever de matemática');
  const headers: Record<string, string> = { Authorization: `Bearer ${assinarToken(contaId, 'user')}` };
  if (chave) headers['X-Idempotency-Key'] = chave;
  return new NextRequest('http://localhost/api/dever', { method: 'POST', headers, body: form });
};

test('sem token responde 401', async () => {
  const res = await criarDever(new NextRequest('http://localhost/api/dever', { method: 'POST' }));
  expect(res.status).toBe(401);
});

test('sem conteúdo responde 400', async () => {
  const conta = await createConta('Ana', 'S', 'd1@example.com', 'hash', 3);
  const form = new FormData();
  const res = await criarDever(new NextRequest('http://localhost/api/dever', {
    method: 'POST', headers: { Authorization: `Bearer ${assinarToken(conta.id, 'user')}` }, body: form,
  }));
  expect(res.status).toBe(400);
});

test('com saldo cria o dever, os passos e debita 1', async () => {
  const conta = await createConta('Ana', 'S', 'd2@example.com', 'hash', 3);
  const res = await criarDever(post(conta.id, 'chave-1'));
  expect(res.status).toBe(200);
  const { id } = await res.json();

  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(2);

  const passos = await pool.query('SELECT ordem, titulo, audio_path, duracao_ms FROM dever_passos WHERE dever_id = $1 ORDER BY ordem', [id]);
  expect(passos.rows).toHaveLength(2);
  expect(passos.rows[0].audio_path).toContain('1.wav');
  expect(passos.rows[0].duracao_ms).toBe(2000);

  const mov = await pool.query('SELECT dever_id FROM movimentos_saldo WHERE conta_id = $1', [conta.id]);
  expect(mov.rows[0].dever_id).toBe(id);
});

test('saldo esgotado responde 402 e não cria dever', async () => {
  const conta = await createConta('Ana', 'S', 'd3@example.com', 'hash', 0);
  const res = await criarDever(post(conta.id, 'chave-2'));
  expect(res.status).toBe(402);
  const { rows } = await pool.query('SELECT count(*)::int AS c FROM deveres WHERE conta_id = $1', [conta.id]);
  expect(rows[0].c).toBe(0);
});

test('LLM falha: nada debitado, nada persistido', async () => {
  const conta = await createConta('Ana', 'S', 'd4@example.com', 'hash', 3);
  gerarStoryboardSeguro.mockRejectedValueOnce(new Error('LLM offline'));
  const res = await criarDever(post(conta.id, 'chave-3'));
  expect(res.status).toBe(500);
  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(3);
  const deveres = await pool.query('SELECT count(*)::int AS c FROM deveres WHERE conta_id = $1', [conta.id]);
  expect(deveres.rows[0].c).toBe(0);
});

test('reenvio com a mesma chave devolve o mesmo dever sem debitar de novo', async () => {
  const conta = await createConta('Ana', 'S', 'd5@example.com', 'hash', 3);
  const id1 = (await (await criarDever(post(conta.id, 'chave-4'))).json()).id;
  const res2 = await criarDever(post(conta.id, 'chave-4'));
  expect(res2.status).toBe(200);
  const corpo = await res2.json();
  expect(corpo.id).toBe(id1);
  expect(corpo.duplicate).toBe(true);

  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(2);
  expect(gerarStoryboardSeguro).toHaveBeenCalledTimes(1);
});

test('corrida com a mesma chave debita exatamente uma vez', async () => {
  const conta = await createConta('Ana', 'S', 'd6@example.com', 'hash', 3);
  const [r1, r2] = await Promise.all([criarDever(post(conta.id, 'chave-5')), criarDever(post(conta.id, 'chave-5'))]);
  expect(r1.status).toBe(200);
  expect(r2.status).toBe(200);
  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(2);
  const mov = await pool.query('SELECT count(*)::int AS c FROM movimentos_saldo WHERE conta_id = $1', [conta.id]);
  expect(mov.rows[0].c).toBe(1);
});

test('sem áudio (Piper ausente) cria o dever com audio_path nulo', async () => {
  const conta = await createConta('Ana', 'S', 'd7@example.com', 'hash', 3);
  sintetizarPassos.mockImplementation(async (_id: string, passos: { ordem: number }[]) =>
    passos.map((p) => ({ ordem: p.ordem, caminho: '', duracao_ms: null })));
  const res = await criarDever(post(conta.id, 'chave-6'));
  expect(res.status).toBe(200);
  const { id } = await res.json();
  const passos = await pool.query('SELECT audio_path, duracao_ms FROM dever_passos WHERE dever_id = $1', [id]);
  expect(passos.rows[0].audio_path).toBeNull();
  expect(passos.rows[0].duracao_ms).toBeNull();
});
```

- [ ] **Step 2: Rodar para confirmar a falha**

Run: `npm run test:db -- test/db/dever-route.test.ts`
Expected: FAIL, módulo da rota não resolve.

- [ ] **Step 3: Implementar a rota**

`app/api/dever/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { consumirSaldo } from '@/lib/quota';
import { criarDever, criarPassos, getDeverPorChave } from '@/lib/repos/deveres';
import { vincularMovimentoADever } from '@/lib/repos/movimentos';
import { comTransacao } from '@/lib/repos/transacao';
import { getPool } from '@/lib/db/pool';
import { gerarStoryboardSeguro } from '@/lib/deveres/llm';
import { sintetizarPassos } from '@/lib/deveres/piper';
import { extrairTextoPDF } from '@/lib/pdf';
import { processarImagem } from '@/lib/imagem';
import { ImagemProcessada } from '@/lib/llm';
import { MAX_IMAGENS } from '@/lib/constantes';

type ResultadoCriacao =
  | { status: 402 }
  | { status: 200; id: string; saldo: number; duplicate?: boolean };

export async function POST(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  try {
    const formData = await req.formData();
    const texto = (formData.get('texto') as string) || '';
    const files = formData.getAll('arquivos') as File[];

    let conteudoCompleto = texto;
    const imagens: ImagemProcessada[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') {
        try { conteudoCompleto += `\n\n--- Conteúdo do PDF: ${file.name} ---\n${await extrairTextoPDF(buffer)}`; } catch {}
      } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) {
        if (imagens.length >= MAX_IMAGENS) continue;
        try {
          const { base64, mime } = await processarImagem(buffer);
          imagens.push({ base64, mime });
        } catch {}
      }
    }

    if (!conteudoCompleto.trim() && imagens.length === 0) {
      return NextResponse.json({ error: 'Envie uma foto do dever ou escreva o enunciado.' }, { status: 400 });
    }

    const chave = req.headers.get('x-idempotency-key');

    const resultado = await comTransacao(async (client): Promise<ResultadoCriacao> => {
      if (chave) {
        const existente = await getDeverPorChave(client, auth.contaId, chave);
        if (existente) {
          const { rows } = await client.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [auth.contaId]);
          return { status: 200, id: existente.id, saldo: rows[0].saldo_revisoes as number, duplicate: true };
        }
      }

      const saldo = await consumirSaldo(client, auth.contaId);
      if (saldo === null) return { status: 402 };

      const { storyboard } = await gerarStoryboardSeguro(conteudoCompleto, imagens);

      // O id do dever é reservado antes da síntese: os WAVs são gravados na pasta
      // dele. Se a transação falhar depois, sobram arquivos órfãos (removidos por
      // scripts/limpar-uploads-orfaos.ts), nunca um áudio apontando para outro dever.
      const id = await criarDever(client, auth.contaId, {
        titulo: storyboard.titulo || null,
        disciplina: storyboard.disciplina || null,
        conteudo_texto: conteudoCompleto,
        resumo_para_pais: storyboard.resumo_para_pais || null,
        chaveIdempotencia: chave,
      });

      const audios = await sintetizarPassos(id, storyboard.passos.map((p, i) => ({ ordem: i + 1, narracao: p.narracao })));
      const audioPorOrdem = new Map(audios.map((a) => [a.ordem, a]));

      await criarPassos(client, id, storyboard.passos.map((p, i) => {
        const audio = audioPorOrdem.get(i + 1);
        return {
          ordem: i + 1,
          titulo: p.titulo,
          narracao: p.narracao,
          cena: p.cena,
          audio_path: audio?.caminho || null,
          duracao_ms: audio?.duracao_ms ?? null,
        };
      }));

      await vincularMovimentoADever(client, auth.contaId, id);
      return { status: 200, id, saldo };
    });

    if (resultado.status === 402) {
      return NextResponse.json(
        { error: 'Você usou seus créditos. Resgate um token para continuar.' },
        { status: 402 },
      );
    }
    return NextResponse.json({
      id: resultado.id,
      saldo: resultado.saldo,
      ...(resultado.duplicate ? { duplicate: true } : {}),
    });
  } catch (err) {
    // Corrida pela mesma chave: a segunda transação toma 23505 no índice único
    // parcial e o débito dela é rollbackado. Reconsulta e devolve o dever da
    // primeira: um único débito no total.
    const chave = req.headers.get('x-idempotency-key');
    if ((err as { code?: string }).code === '23505' && chave) {
      const existente = await getDeverPorChave(getPool(), auth.contaId, chave);
      if (existente) {
        const { rows } = await getPool().query('SELECT saldo_revisoes FROM contas WHERE id = $1', [auth.contaId]);
        return NextResponse.json({ id: existente.id, saldo: rows[0].saldo_revisoes, duplicate: true });
      }
    }
    console.error('[POST /api/dever] falha:', err);
    return NextResponse.json({ error: 'Não consegui falar com a explicadora. Tente novamente.' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Rodar para confirmar o passo**

Run: `npm run test:db -- test/db/dever-route.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Rodar a suíte de banco completa**

Run: `npm run test:db`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/dever/route.ts test/db/dever-route.test.ts
git commit -m "feat(deveres): rota de criacao com saldo, idempotencia e sintese de audio"
```

---

## Task 10: Rotas de leitura (grid, detalhe, áudio autenticado)

**Files:**
- Create: `app/api/deveres/route.ts`
- Create: `app/api/dever/[id]/route.ts`
- Create: `app/api/dever/[id]/audio/[ordem]/route.ts`
- Test: `test/db/dever-route.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `autenticar`; `listarDeveresComResumo`/`getDever`/`getPassos`; `fs.promises.readFile`.
- Produces:
  - `GET /api/deveres` → `ResumoDever[]`
  - `GET /api/dever/[id]` → `{ dever, passos }`
  - `GET /api/dever/[id]/audio/[ordem]` → `audio/wav` (ou 404)

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar a `test/db/dever-route.test.ts` (importar `GET as lerDever` de `../../app/api/dever/[id]/route`, `GET as listarDeveres` de `../../app/api/deveres/route`, `GET as lerAudio` de `../../app/api/dever/[id]/audio/[ordem]/route`, `criarDever`/`criarPassos` de `../../lib/repos/deveres`, `fs` de `node:fs/promises`, `path` de `node:path`):

```ts
const reqComToken = (contaId: string) =>
  new NextRequest('http://localhost/api/deveres', {
    headers: { Authorization: `Bearer ${assinarToken(contaId, 'user')}` },
  });

test('GET /api/deveres mostra só os deveres da conta', async () => {
  const a = await createConta('Ana', 'S', 'd8@example.com', 'hash', 3);
  const b = await createConta('Bob', 'T', 'd9@example.com', 'hash', 3);
  await criarDever(pool, a.id, { titulo: 'T', disciplina: null, conteudo_texto: 'x', resumo_para_pais: null });
  const res = await listarDeveres(reqComToken(b.id));
  expect(await res.json()).toHaveLength(0);
});

test('GET /api/dever/[id] devolve dever e passos ordenados', async () => {
  const a = await createConta('Ana', 'S', 'd10@example.com', 'hash', 3);
  const id = await criarDever(pool, a.id, { titulo: 'T', disciplina: 'Matemática', conteudo_texto: 'x', resumo_para_pais: null });
  await criarPassos(pool, id, [
    { ordem: 1, titulo: 'Primeiro', narracao: 'a', cena, audio_path: null, duracao_ms: 1000 },
    { ordem: 2, titulo: 'Depois', narracao: 'b', cena, audio_path: null, duracao_ms: 2000 },
  ]);
  const res = await lerDever(reqComToken(a.id), { params: { id } });
  const corpo = await res.json();
  expect(res.status).toBe(200);
  expect(corpo.dever.disciplina).toBe('Matemática');
  expect(corpo.passos.map((p: { titulo: string }) => p.titulo)).toEqual(['Primeiro', 'Depois']);
});

test('conta B não lê dever de A', async () => {
  const a = await createConta('Ana', 'S', 'd11@example.com', 'hash', 3);
  const b = await createConta('Bob', 'T', 'd12@example.com', 'hash', 3);
  const id = await criarDever(pool, a.id, { titulo: null, disciplina: null, conteudo_texto: 'x', resumo_para_pais: null });
  const res = await lerDever(reqComToken(b.id), { params: { id } });
  expect(res.status).toBe(404);
});

test('GET de áudio exige posse e devolve o WAV', async () => {
  const a = await createConta('Ana', 'S', 'd13@example.com', 'hash', 3);
  const b = await createConta('Bob', 'T', 'd14@example.com', 'hash', 3);
  const id = await criarDever(pool, a.id, { titulo: null, disciplina: null, conteudo_texto: 'x', resumo_para_pais: null });
  const relativo = `uploads/deveres/${id}/1.wav`;
  await fs.mkdir(path.join(process.cwd(), 'uploads', 'deveres', id), { recursive: true });
  await fs.writeFile(path.join(process.cwd(), relativo), Buffer.from('RIFF-dados'));

  await criarPassos(pool, id, [
    { ordem: 1, titulo: 'a', narracao: 'a', cena, audio_path: relativo, duracao_ms: 1000 },
  ]);

  const resA = await lerAudio(reqComToken(a.id), { params: { id, ordem: '1' } });
  expect(resA.status).toBe(200);
  expect(resA.headers.get('content-type')).toBe('audio/wav');

  const resB = await lerAudio(reqComToken(b.id), { params: { id, ordem: '1' } });
  expect(resB.status).toBe(404);

  await fs.rm(path.join(process.cwd(), 'uploads', 'deveres', id), { recursive: true, force: true });
});

test('áudio de passo inexistente responde 404', async () => {
  const a = await createConta('Ana', 'S', 'd15@example.com', 'hash', 3);
  const id = await criarDever(pool, a.id, { titulo: null, disciplina: null, conteudo_texto: 'x', resumo_para_pais: null });
  const res = await lerAudio(reqComToken(a.id), { params: { id, ordem: '9' } });
  expect(res.status).toBe(404);
});
```

- [ ] **Step 2: Rodar para confirmar a falha**

Run: `npm run test:db -- test/db/dever-route.test.ts`
Expected: FAIL, módulos das rotas não resolvem.

- [ ] **Step 3: Implementar as três rotas**

`app/api/deveres/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { listarDeveresComResumo } from '@/lib/repos/deveres';

export async function GET(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  return NextResponse.json(await listarDeveresComResumo(auth.contaId));
}
```

`app/api/dever/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getDever, getPassos } from '@/lib/repos/deveres';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  const dever = await getDever(params.id, auth.contaId);
  if (!dever) return NextResponse.json({ error: 'Dever não encontrado.' }, { status: 404 });

  return NextResponse.json({ dever, passos: await getPassos(params.id) });
}
```

`app/api/dever/[id]/audio/[ordem]/route.ts`:

```ts
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getDever, getPassos } from '@/lib/repos/deveres';

// O áudio fica fora de public/ justamente para passar por aqui: sem esta rota,
// qualquer pessoa com a URL leria a explicação de outra criança.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; ordem: string } },
) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  const dever = await getDever(params.id, auth.contaId);
  if (!dever) return NextResponse.json({ error: 'Dever não encontrado.' }, { status: 404 });

  const ordem = Number(params.ordem);
  if (!Number.isInteger(ordem) || ordem < 1) {
    return NextResponse.json({ error: 'Passo inválido.' }, { status: 404 });
  }

  const passo = (await getPassos(params.id)).find((p) => p.ordem === ordem);
  if (!passo?.audio_path) return NextResponse.json({ error: 'Áudio indisponível.' }, { status: 404 });

  try {
    const buffer = await fs.readFile(path.join(process.cwd(), passo.audio_path));
    return new NextResponse(new Uint8Array(buffer), {
      headers: { 'content-type': 'audio/wav', 'cache-control': 'private, max-age=3600' },
    });
  } catch {
    return NextResponse.json({ error: 'Áudio indisponível.' }, { status: 404 });
  }
}
```

- [ ] **Step 4: Rodar para confirmar o passo**

Run: `npm run test:db -- test/db/dever-route.test.ts`
Expected: PASS (13 testes).

- [ ] **Step 5: Commit**

```bash
git add app/api/deveres app/api/dever test/db/dever-route.test.ts
git commit -m "feat(deveres): rotas de leitura com audio autenticado"
```

---

## Task 11: Chave de tentativa do dever e download autenticado do áudio

**Files:**
- Create: `lib/client/tentativaDever.ts`
- Create: `lib/client/audio.ts`
- Test: `test/unit/tentativaDever.test.ts`
- Test: `test/unit/audio.test.ts`

**Interfaces:**
- Consumes: `apiFetch` de `lib/client/api.ts`.
- Produces:
  - `function guardarTentativaDever(chave: string): void`, `function lerTentativaDever(): string | null`, `function limparTentativaDever(): void`
  - `async function carregarAudioDever(deverId: string, ordem: number): Promise<string | null>` (object URL, `null` se indisponível)

- [ ] **Step 1: Escrever os testes que falham**

`test/unit/tentativaDever.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { guardarTentativaDever, lerTentativaDever, limparTentativaDever } from '@/lib/client/tentativaDever';

afterEach(() => localStorage.clear());

describe('tentativaDever', () => {
  it('guarda e lê a chave', () => {
    guardarTentativaDever('chave-1');
    expect(lerTentativaDever()).toBe('chave-1');
  });

  it('limpar remove', () => {
    guardarTentativaDever('chave-1');
    limparTentativaDever();
    expect(lerTentativaDever()).toBeNull();
  });

  it('não conflita com a tentativa de revisão', async () => {
    const { guardarTentativa, lerTentativa } = await import('@/lib/client/tentativa');
    guardarTentativa('revisao-1');
    guardarTentativaDever('dever-1');
    expect(lerTentativa()).toBe('revisao-1');
    expect(lerTentativaDever()).toBe('dever-1');
  });
});
```

`test/unit/audio.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { carregarAudioDever } from '@/lib/client/audio';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('carregarAudioDever', () => {
  it('devolve object URL quando o áudio existe', async () => {
    localStorage.setItem('estudo_token', 'token');
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, blob: async () => new Blob(['x']) }) as Response);
    const url = await carregarAudioDever('abc', 2);
    expect(url).toMatch(/^blob:/);
  });

  it('devolve null quando a rota responde 404', async () => {
    localStorage.setItem('estudo_token', 'token');
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 404, blob: async () => new Blob() }) as Response);
    expect(await carregarAudioDever('abc', 2)).toBeNull();
  });

  it('devolve null se a rede falhar', async () => {
    localStorage.setItem('estudo_token', 'token');
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
    expect(await carregarAudioDever('abc', 2)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar para confirmar a falha**

Run: `npx vitest run test/unit/tentativaDever.test.ts test/unit/audio.test.ts`
Expected: FAIL, módulos não resolvem.

- [ ] **Step 3: Implementar**

`lib/client/tentativaDever.ts`:

```ts
// Chave separada da de revisão: o usuário pode ter uma tentativa de revisão
// pendente e criar um dever na mesma sessão sem que uma sobrescreva a outra.
const CHAVE = 'estudo_tentativa_dever';

export function guardarTentativaDever(chave: string): void {
  localStorage.setItem(CHAVE, chave);
}

// Chamado no pré-render, onde localStorage não existe: sem sessão não há
// tentativa pendente, então devolve null em vez de lançar.
export function lerTentativaDever(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(CHAVE);
}

export function limparTentativaDever(): void {
  localStorage.removeItem(CHAVE);
}
```

`lib/client/audio.ts`:

```ts
import { apiFetch } from './api';

// O elemento <audio> não envia cabeçalho Authorization. A única forma de manter a
// rota autenticada é baixar o WAV via apiFetch e tocar pela object URL.
export async function carregarAudioDever(deverId: string, ordem: number): Promise<string | null> {
  try {
    const res = await apiFetch(`/api/dever/${deverId}/audio/${ordem}`);
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Rodar para confirmar o passo**

Run: `npx vitest run test/unit/tentativaDever.test.ts test/unit/audio.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/client/tentativaDever.ts lib/client/audio.ts test/unit/tentativaDever.test.ts test/unit/audio.test.ts
git commit -m "feat(deveres): tentativa separada e download autenticado do audio"
```

---

## Task 12: Renderizador do canvas

**Files:**
- Create: `lib/deveres/desenho.ts`
- Test: `test/unit/desenho.test.ts`

**Interfaces:**
- Consumes: `Primitivo` de `lib/deveres/cena.ts`, `PrimitivoAnimada` de `lib/deveres/animacao.ts`.
- Produces:
  - `interface Dimensoes { largura: number; altura: number }`
  - `function px(valor: number, dimensao: number): number`
  - `function desenharFundo(ctx: CanvasRenderingContext2D, cor: string, d: Dimensoes): void`
  - `function desenharPrimitiva(ctx: CanvasRenderingContext2D, item: PrimitivoAnimada, d: Dimensoes): void`

Nota para quem executar: jsdom não implementa `canvas.getContext`, então **não** testar `desenharPrimitiva` chamando um contexto real. Testar `px` e um helper de interpolação de traço, que é onde mora a matemática. A pintura em si é verificada manualmente no navegador (Task 15).

- [ ] **Step 1: Escrever o teste que falha**

`test/unit/desenho.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { px, pontoDoTraco } from '@/lib/deveres/desenho';

describe('px', () => {
  it('converte coordenada normalizada em pixel', () => {
    expect(px(0.5, 800)).toBe(400);
    expect(px(0, 800)).toBe(0);
    expect(px(1, 600)).toBe(600);
  });

  it('clampa valor fora de 0..1 (defesa em profundidade)', () => {
    expect(px(1.4, 100)).toBe(100);
    expect(px(-0.2, 100)).toBe(0);
  });
});

describe('pontoDoTraco', () => {
  it('no progresso 0 o traço não saiu', () => {
    expect(pontoDoTraco(10, 100, 0)).toBe(10);
  });

  it('no progresso 1 o traço chegou ao fim', () => {
    expect(pontoDoTraco(10, 100, 1)).toBe(100);
  });

  it('no meio do traço', () => {
    expect(pontoDoTraco(0, 100, 0.5)).toBe(50);
  });
});
```

- [ ] **Step 2: Rodar para confirmar a falha**

Run: `npx vitest run test/unit/desenho.test.ts`
Expected: FAIL, módulo não resolve.

- [ ] **Step 3: Implementar**

`lib/deveres/desenho.ts`:

```ts
import type { Primitivo } from './cena';
import type { PrimitivoAnimada } from './animacao';

export interface Dimensoes { largura: number; altura: number }

export function px(valor: number, dimensao: number): number {
  const v = Math.min(1, Math.max(0, valor));
  return v * dimensao;
}

// Animação "desenhar" traça a linha progressivamente: o ponto final é
// interpolado entre origem e destino.
export function pontoDoTraco(origem: number, destino: number, progresso: number): number {
  return origem + (destino - origem) * Math.min(1, Math.max(0, progresso));
}

function escala(item: PrimitivoAnimada): number {
  if (item.primitivo.animacao === 'crescer' || item.primitivo.animacao === 'pular') {
    return 0.6 + 0.4 * item.progresso;
  }
  return 1;
}

function opacidade(item: PrimitivoAnimada): number {
  return item.primitivo.animacao === 'fade' ? item.progresso : 1;
}

export function desenharFundo(ctx: CanvasRenderingContext2D, cor: string, d: Dimensoes): void {
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, d.largura, d.altura);
}

function texto(ctx: CanvasRenderingContext2D, p: Extract<Primitivo, { kind: 'texto' }>, d: Dimensoes, item: PrimitivoAnimada): void {
  const tamanho = px(p.tamanho, d.altura) * escala(item);
  ctx.font = `700 ${tamanho}px var(--font-nunito, system-ui), system-ui, sans-serif`;
  ctx.fillStyle = p.cor;
  ctx.globalAlpha = opacidade(item);
  ctx.textAlign = p.alinhamento === 'centro' ? 'center' : p.alinhamento === 'direita' ? 'right' : 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.valor, px(p.x, d.largura), px(p.y, d.altura));
  ctx.globalAlpha = 1;
}

function emoji(ctx: CanvasRenderingContext2D, p: Extract<Primitivo, { kind: 'emoji' }>, d: Dimensoes, item: PrimitivoAnimada): void {
  const tamanho = px(p.tamanho, d.altura) * escala(item);
  ctx.font = `${tamanho}px system-ui, sans-serif`;
  ctx.globalAlpha = opacidade(item);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.valor, px(p.x, d.largura), px(p.y, d.altura));
  ctx.globalAlpha = 1;
}

function retaNumerica(ctx: CanvasRenderingContext2D, p: Extract<Primitivo, { kind: 'reta_numerica' }>, d: Dimensoes, item: PrimitivoAnimada): void {
  const x0 = px(p.x, d.largura);
  const w = px(p.w, d.largura);
  const y = px(p.y, d.altura);
  const fim = pontoDoTraco(x0, x0 + w, item.progresso);

  ctx.strokeStyle = p.cor;
  ctx.lineWidth = Math.max(2, d.altura * 0.006);
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(fim, y);
  ctx.stroke();

  const intervalo = p.maximo - p.minimo || 1;
  for (const marca of p.marcas) {
    const mx = x0 + ((marca - p.minimo) / intervalo) * w;
    if (mx > fim) continue;
    ctx.beginPath();
    ctx.moveTo(mx, y - d.altura * 0.02);
    ctx.lineTo(mx, y + d.altura * 0.02);
    ctx.stroke();
    ctx.fillStyle = '#2D2A3E';
    ctx.font = `600 ${d.altura * 0.03}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(marca), mx, y + d.altura * 0.03);
  }

  if (p.destaque !== undefined) {
    const dx = x0 + ((p.destaque - p.minimo) / intervalo) * w;
    if (dx <= fim) {
      ctx.fillStyle = '#FF8A3D';
      ctx.beginPath();
      ctx.arc(dx, y, d.altura * 0.022, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function barraModelo(ctx: CanvasRenderingContext2D, p: Extract<Primitivo, { kind: 'barra_modelo' }>, d: Dimensoes, item: PrimitivoAnimada): void {
  const x0 = px(p.x, d.largura);
  const y0 = px(p.y, d.altura);
  const w = px(p.w, d.largura) * item.progresso;
  const h = px(p.h, d.altura);
  const total = p.partes.reduce((s, parte) => s + parte.valor, 0) || 1;

  let cursor = x0;
  for (const parte of p.partes) {
    const largura = (parte.valor / total) * w;
    ctx.fillStyle = parte.cor ?? '#7C5CFC';
    ctx.fillRect(cursor, y0, largura, h);
    if (parte.rotulo && largura > d.largura * 0.03) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 ${d.altura * 0.035}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(parte.rotulo, cursor + largura / 2, y0 + h / 2);
    }
    cursor += largura;
  }
}

function balanca(ctx: CanvasRenderingContext2D, p: Extract<Primitivo, { kind: 'balanca' }>, d: Dimensoes, item: PrimitivoAnimada): void {
  const cx = px(p.x, d.largura);
  const cy = px(p.y, d.altura);
  const w = px(p.w, d.largura);
  const angulo = (p.inclinacao * Math.PI) / 180 * item.progresso;

  ctx.strokeStyle = p.cor;
  ctx.lineWidth = Math.max(2, d.altura * 0.008);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy + d.altura * 0.12);
  ctx.stroke();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angulo);
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(w / 2, 0);
  ctx.stroke();
  ctx.fillStyle = '#2D2A3E';
  ctx.font = `700 ${d.altura * 0.035}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(p.prato_esquerdo.join(' + '), -w / 2, -d.altura * 0.01);
  ctx.fillText(p.prato_direito.join(' + '), w / 2, -d.altura * 0.01);
  ctx.restore();
}

function blocos(ctx: CanvasRenderingContext2D, p: Extract<Primitivo, { kind: 'blocos' }>, d: Dimensoes, item: PrimitivoAnimada): void {
  const x0 = px(p.x, d.largura);
  const y0 = px(p.y, d.altura);
  const lado = d.altura * 0.06;
  const espacamento = lado * 0.3;

  for (let i = 0; i < p.itens; i++) {
    // Só o bloco cujo "nascimento" já passou pelo progresso: a contagem aparece
    // junto da fala, não de uma vez.
    const nascimento = i / Math.max(1, p.itens);
    if (nascimento > item.progresso) break;
    const linha = Math.floor(i / p.colunas);
    const coluna = i % p.colunas;
    const bx = x0 + coluna * (lado + espacamento);
    const by = y0 + linha * (lado + espacamento);
    ctx.fillStyle = p.cor;
    if (p.tipo === 'moeda') {
      ctx.beginPath();
      ctx.arc(bx + lado / 2, by + lado / 2, lado / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(bx, by, lado, lado);
    }
  }
}

export function desenharPrimitiva(
  ctx: CanvasRenderingContext2D, item: PrimitivoAnimada, d: Dimensoes,
): void {
  const p = item.primitivo;
  switch (p.kind) {
    case 'retangulo': {
      const e = escala(item);
      ctx.globalAlpha = opacidade(item);
      ctx.fillStyle = p.cor;
      const w = px(p.w, d.largura) * e;
      const h = px(p.h, d.altura) * e;
      const x = px(p.x, d.largura) - w / 2;
      const y = px(p.y, d.altura) - h / 2;
      if (p.raio > 0 && typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, px(p.raio, d.altura));
        ctx.fill();
      } else {
        ctx.fillRect(x, y, w, h);
      }
      ctx.globalAlpha = 1;
      return;
    }
    case 'circulo': {
      ctx.globalAlpha = opacidade(item);
      ctx.fillStyle = p.cor;
      ctx.beginPath();
      ctx.arc(px(p.x, d.largura), px(p.y, d.altura), px(p.r, d.altura) * escala(item), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    case 'linha':
    case 'seta': {
      const x1 = px(p.x, d.largura);
      const y1 = px(p.y, d.altura);
      const x2 = pontoDoTraco(x1, px(p.x2, d.largura), item.progresso);
      const y2 = pontoDoTraco(y1, px(p.y2, d.altura), item.progresso);
      ctx.strokeStyle = p.cor;
      ctx.lineWidth = Math.max(2, px(p.espessura, d.altura));
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (p.kind === 'seta' && item.progresso > 0.9) {
        const angulo = Math.atan2(y2 - y1, x2 - x1);
        const cabeca = d.altura * 0.025;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - cabeca * Math.cos(angulo - 0.5), y2 - cabeca * Math.sin(angulo - 0.5));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - cabeca * Math.cos(angulo + 0.5), y2 - cabeca * Math.sin(angulo + 0.5));
        ctx.stroke();
      }
      return;
    }
    case 'texto': return texto(ctx, p, d, item);
    case 'emoji': return emoji(ctx, p, d, item);
    case 'reta_numerica': return retaNumerica(ctx, p, d, item);
    case 'barra_modelo': return barraModelo(ctx, p, d, item);
    case 'balanca': return balanca(ctx, p, d, item);
    case 'blocos': return blocos(ctx, p, d, item);
    case 'destaque': {
      // Pulso: a opacidade oscila com o progresso, para apontar sem cobrir.
      const pulso = 0.25 + 0.25 * Math.sin(item.progresso * Math.PI * 2);
      ctx.globalAlpha = pulso;
      ctx.fillStyle = '#FF8A3D';
      ctx.fillRect(px(p.x, d.largura), px(p.y, d.altura), px(p.w, d.largura), px(p.h, d.altura));
      ctx.globalAlpha = 1;
      return;
    }
  }
}
```

- [ ] **Step 4: Rodar para confirmar o passo**

Run: `npx vitest run test/unit/desenho.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros em `lib/deveres/desenho.ts`.

- [ ] **Step 6: Commit**

```bash
git add lib/deveres/desenho.ts test/unit/desenho.test.ts
git commit -m "feat(deveres): renderizador de primitivas do canvas"
```

---

## Task 13: Formulário do pai e grid

**Files:**
- Create: `components/deveres/DeverForm.tsx`
- Create: `components/deveres/DeverGrid.tsx`
- Create: `app/deveres/page.tsx`
- Create: `app/deveres/nova/page.tsx`
- Modify: `components/Header.tsx`
- Test: `components/deveres/DeverForm.test.tsx`
- Test: `components/Header.test.tsx` (acrescentar)

**Interfaces:**
- Consumes: `apiFetch`/`lerToken`, `MAX_IMAGENS`, `guardarTentativaDever`/`lerTentativaDever`/`limparTentativaDever`, `notificarSaldo` de `lib/client/saldo`, `ResumoDever` de `lib/types`, `Mascote`, `LoadingQuestoes`.
- Produces:
  - `DeverForm` (default export, sem props)
  - `DeverGrid` (default export, props `{ deveres: ResumoDever[] }`) e `NovoDeverBotao`
  - `tituloDoDever(d: { titulo: string | null; conteudo_texto: string }): string`

- [ ] **Step 1: Escrever o teste que falha**

`components/deveres/DeverForm.test.tsx`:

```tsx
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeverForm from '@/components/deveres/DeverForm';

// Mesmo esqueleto de components/RevisaoForm.test.tsx: router hoisted, usePathname
// mockado (o Header marca link ativo), userEvent em vez de fireEvent.
const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/deveres/nova' }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  router.push.mockClear();
});

const button = () => screen.getByRole('button', { name: /Explicar o dever/ }) as HTMLButtonElement;

test('botão de enviar está desabilitado sem conteúdo', () => {
  render(<DeverForm />);
  expect(button().disabled).toBe(true);
});

test('texto simples habilita o envio', async () => {
  const user = userEvent.setup();
  render(<DeverForm />);
  await user.type(screen.getByLabelText('Escreva o enunciado (opcional)'), 'Quanto é 12 + 7?');
  expect(button().disabled).toBe(false);
});

test('envio chama a rota, envia o texto e limpa a tentativa pendente', async () => {
  const user = userEvent.setup();
  const requests: FormData[] = [];
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
    requests.push(options.body as FormData);
    return { ok: true, status: 200, json: async () => ({ id: 'dever-1', saldo: 2 }) } as Response;
  });

  render(<DeverForm />);
  await user.type(screen.getByLabelText('Escreva o enunciado (opcional)'), 'dever de matemática');
  await user.click(button());

  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].get('texto')).toBe('dever de matemática');
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/deveres/dever-1'));
  expect(localStorage.getItem('estudo_tentativa_dever')).toBeNull();
});

test('402 mostra a mensagem de crédito esgotado', async () => {
  const user = userEvent.setup();
  vi.stubGlobal('fetch', async () => ({
    ok: false, status: 402,
    json: async () => ({ error: 'Você usou seus créditos. Resgate um token para continuar.' }),
  }) as Response);

  render(<DeverForm />);
  await user.type(screen.getByLabelText('Escreva o enunciado (opcional)'), 'dever');
  await user.click(button());

  expect(await screen.findByRole('alert')).toHaveTextContent('Resgate um token');
});

test('acumula fotos e PDFs e envia tudo junto', async () => {
  const user = userEvent.setup();
  const requests: FormData[] = [];
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
    requests.push(options.body as FormData);
    return { ok: false, status: 500, json: async () => ({ error: 'Tente novamente.' }) } as Response;
  });

  render(<DeverForm />);
  const input = screen.getByLabelText('Fotos e PDFs do dever');
  await user.upload(input, new File(['a'], 'pagina-1.jpg', { type: 'image/jpeg' }));
  await user.upload(input, [
    new File(['b'], 'atividade.pdf', { type: 'application/pdf' }),
    new File(['c'], 'pagina-2.jpg', { type: 'image/jpeg' }),
  ]);
  expect(button().disabled).toBe(false);
  await user.click(button());

  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].getAll('arquivos').map((f) => (f as File).name))
    .toEqual(['pagina-1.jpg', 'atividade.pdf', 'pagina-2.jpg']);
});
```

Acrescentar a `components/Header.test.tsx`:

```ts
test('tem o link Deveres na navegação', () => {
  render(<Header />);
  expect(screen.getByRole('link', { name: /deveres/i })).toBeTruthy();
});
```

- [ ] **Step 2: Rodar para confirmar a falha**

Run: `npx vitest run components/deveres/DeverForm.test.tsx components/Header.test.tsx`
Expected: FAIL, `DeverForm` não resolve e o link "Deveres" não existe.

- [ ] **Step 3: Implementar o formulário**

`components/deveres/DeverForm.tsx` — mesmo esqueleto de `RevisaoForm`, com a tentativa de dever e a rota de dever:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Plus, Sparkles, Trash2 } from 'lucide-react';
import LoadingQuestoes from '@/components/LoadingQuestoes';
import { MAX_IMAGENS } from '@/lib/constantes';
import { apiFetch } from '@/lib/client/api';
import { notificarSaldo } from '@/lib/client/saldo';
import { guardarTentativaDever, lerTentativaDever, limparTentativaDever } from '@/lib/client/tentativaDever';

export default function DeverForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState('');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [avisoArquivos, setAvisoArquivos] = useState('');
  const [retomando, setRetomando] = useState(() => lerTentativaDever() !== null);

  // Retomada: a geração é longa e o pai pode sair no meio. Se o servidor
  // commitou, o dever já existe: redireciona em vez de mostrar o form.
  useEffect(() => {
    const chave = lerTentativaDever();
    if (!chave) return;
    apiFetch('/api/deveres')
      .then(async (r) => {
        if (!r.ok) { setRetomando(false); return; }
        const lista = await r.json();
        const encontrada = lista.find((linha: { id: string; chave_idempotencia?: string }) =>
          linha.chave_idempotencia === chave);
        if (encontrada) {
          limparTentativaDever();
          router.replace(`/deveres/${encontrada.id}`);
        } else {
          setRetomando(false);
        }
      })
      .catch(() => setRetomando(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (carregando || (!texto.trim() && arquivos.length === 0)) return;
    setCarregando(true);
    setErro('');

    const chave = crypto.randomUUID();
    guardarTentativaDever(chave);

    const formData = new FormData();
    formData.append('texto', texto.trim());
    for (const file of arquivos) formData.append('arquivos', file);

    try {
      const res = await apiFetch('/api/dever', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': chave },
        body: formData,
      });
      if (res.status === 402) {
        setErro((await res.json()).error);
        setCarregando(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      limparTentativaDever();
      notificarSaldo();
      router.push(`/deveres/${data.id}`);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Algo deu errado. Tente novamente.');
      setCarregando(false);
    }
  };

  if (carregando || retomando) {
    return (
      <div>
        <LoadingQuestoes />
        <p className="text-center text-ink/60 text-lg -mt-4">
          A Lia está olhando o dever e preparando os desenhos. Isso pode levar um minuto.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="dever-enunciado" className="block text-xl font-semibold text-ink mb-2">
          Escreva o enunciado (opcional)
        </label>
        <textarea
          id="dever-enunciado"
          name="dever-enunciado"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Se a letra estiver difícil de ler, escreva o enunciado aqui..."
          className="input h-32 resize-y"
        />
      </div>

      <div className="bg-white rounded-2xl border-2 border-dashed border-ink/20 p-4 sm:p-6">
        <label htmlFor="dever-arquivos" className="block text-xl font-semibold text-ink mb-2">
          Fotos e PDFs do dever
        </label>
        <p id="ajuda-dever" className="text-ink/70 mb-4">
          Fotografe cada página do dever com boa luz e letra legível. Adicione um arquivo por vez ou vários juntos.
        </p>
        <input
          ref={inputRef}
          id="dever-arquivos"
          name="dever-arquivos"
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.pdf"
          aria-describedby="ajuda-dever"
          tabIndex={-1}
          onChange={(e) => {
            const selecionados = Array.from(e.target.files || []);
            e.target.value = '';
            if (!selecionados.length) return;
            let imagens = arquivos.filter((f) => !f.name.toLowerCase().endsWith('.pdf')).length;
            let excedentes = 0;
            let invalidos = 0;
            const aceitos = selecionados.filter((file) => {
              if (!/\.(png|jpe?g|webp|pdf)$/i.test(file.name)) { invalidos++; return false; }
              if (file.name.toLowerCase().endsWith('.pdf')) return true;
              if (imagens >= MAX_IMAGENS) { excedentes++; return false; }
              imagens++;
              return true;
            });
            setArquivos((anteriores) => [...anteriores, ...aceitos]);
            setAvisoArquivos([
              excedentes ? `Máximo de ${MAX_IMAGENS} imagens no total. ${excedentes} imagem(ns) não adicionada(s).` : '',
              invalidos ? 'Alguns arquivos não foram adicionados. Use PNG, JPG, WEBP ou PDF.' : '',
            ].filter(Boolean).join(' '));
            setErro('');
          }}
          className="sr-only"
        />
        <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary !w-auto !text-lg !py-3 focus-visible:outline-offset-4">
          <Plus size={22} aria-hidden="true" />
          {arquivos.length ? 'Adicionar mais arquivos' : 'Adicionar fotos ou PDFs'}
        </button>
        <p className="text-sm text-ink/50 mt-3">PNG, JPG, WEBP e PDF. Até {MAX_IMAGENS} imagens no total.</p>
        <p role="status" className="text-ink mt-4 font-medium">
          {arquivos.length === 0
            ? 'Nenhum arquivo adicionado ainda.'
            : arquivos.length === 1 ? '1 arquivo adicionado' : `${arquivos.length} arquivos adicionados`}
        </p>
        {arquivos.length > 0 && (
          <ul className="mt-3 space-y-2" aria-label="Arquivos adicionados">
            {arquivos.map((file, index) => (
              <li key={index} className="flex items-center gap-3 rounded-xl bg-ink/5 p-3">
                <Camera size={24} className="shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-ink break-all">{file.name}</p>
                  <p className="text-sm text-ink/50">{Math.max(1, Math.ceil(file.size / 1024))} KB</p>
                </div>
                <button type="button" aria-label={`Remover ${file.name}`} onClick={() => {
                  setArquivos((anteriores) => anteriores.filter((_, i) => i !== index));
                  setAvisoArquivos('');
                }} className="shrink-0 p-3 rounded-lg text-red-600 hover:bg-red-50 focus-visible:outline-offset-2">
                  <Trash2 size={20} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {avisoArquivos && <p role="alert" className="text-amber-700 mt-2">{avisoArquivos}</p>}
      </div>

      {erro && (
        <div role="alert" className="bg-danger-light border-2 border-danger/40 rounded-2xl p-4 text-danger text-lg font-semibold">
          {erro}
        </div>
      )}

      <p className="text-ink/70 text-center">
        A Lia explica o dever em desenhos e áudio. Ela nunca entrega a resposta: explica o caminho para a criança fazer sozinha.
      </p>
      <button type="submit" disabled={carregando || (!texto.trim() && arquivos.length === 0)} className="btn-primary">
        <Sparkles size={24} aria-hidden="true" /> Explicar o dever
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Implementar a grid**

`components/deveres/DeverGrid.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ResumoDever } from '@/lib/types';

export function tituloDoDever(d: { titulo: string | null; conteudo_texto: string }): string {
  return d.titulo || d.conteudo_texto.slice(0, 60) || 'Dever sem título';
}

export default function DeverGrid({ deveres }: { deveres: ResumoDever[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {deveres.map((d) => (
        <Link key={d.id} href={`/deveres/${d.id}`}
          className="card block hover:shadow-card-hover transition-shadow">
          <p className="font-extrabold text-ink text-lg truncate mb-2">{tituloDoDever(d)}</p>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {d.disciplina && <span className="badge bg-primary-light text-primary-dark">{d.disciplina}</span>}
            <span className="badge bg-secondary-light text-secondary-ink">{d.total_passos} passos</span>
          </div>
          {d.resumo_para_pais && (
            <p className="text-ink/70 text-sm line-clamp-2 mb-3">{d.resumo_para_pais}</p>
          )}
          <p className="text-sm text-ink/60">{new Date(d.criado_em).toLocaleDateString('pt-BR')}</p>
        </Link>
      ))}
    </div>
  );
}

export function NovoDeverBotao() {
  return (
    <Link href="/deveres/nova" className="btn-primary !w-auto">
      <Plus size={22} aria-hidden="true" /> Novo dever
    </Link>
  );
}
```

- [ ] **Step 5: Implementar as páginas**

`app/deveres/page.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Backpack } from 'lucide-react';
import Header from '@/components/Header';
import Mascote from '@/components/Mascote';
import DeverGrid, { NovoDeverBotao } from '@/components/deveres/DeverGrid';
import { apiFetch, lerToken } from '@/lib/client/api';
import { ResumoDever } from '@/lib/types';

export default function Deveres() {
  const router = useRouter();
  const [deveres, setDeveres] = useState<ResumoDever[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!lerToken()) {
      router.replace('/login');
      return;
    }
  }, [router]);

  const carregar = useCallback(() => {
    apiFetch('/api/deveres')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setDeveres(data); })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-primary flex items-center gap-2">
            <Backpack size={28} aria-hidden="true" /> Dever de casa
          </h1>
          <NovoDeverBotao />
        </div>

        {carregando ? (
          <p className="text-ink/70">Carregando os deveres...</p>
        ) : deveres.length === 0 ? (
          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <Mascote humor="pensando" className="w-20 h-20 animate-float" decorative />
            </div>
            <p className="text-xl font-extrabold text-ink mb-2">Nenhum dever por aqui ainda.</p>
            <p className="text-ink/70 mb-5">
              Fotografe o caderno da criança e a Lia explica o dever em desenhos e áudio.
            </p>
            <NovoDeverBotao />
          </div>
        ) : (
          <DeverGrid deveres={deveres} />
        )}
      </main>
    </>
  );
}
```

`app/deveres/nova/page.tsx`:

```tsx
import { Camera } from 'lucide-react';
import Header from '@/components/Header';
import DeverForm from '@/components/deveres/DeverForm';

export default function NovoDever() {
  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary flex items-center gap-2">
          <Camera size={28} aria-hidden="true" /> Novo dever
        </h1>
        <div className="card">
          <DeverForm />
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 6: Acrescentar o link no Header**

Em `components/Header.tsx`, importar `Backpack` junto dos ícones de `lucide-react` e inserir o link entre "Revisões" e "Créditos":

```tsx
          <Link href="/deveres" className={navClass('/deveres')} aria-current={ativo('/deveres') ? 'page' : undefined}>
            <Backpack size={18} aria-hidden="true" /> Deveres
          </Link>
```

- [ ] **Step 7: Rodar os testes**

Run: `npm test`
Expected: PASS em `DeverForm.test.tsx` (4 testes) e `Header.test.tsx` (3 testes).

- [ ] **Step 8: Commit**

```bash
git add components/deveres app/deveres components/Header.tsx components/deveres/DeverForm.test.tsx components/Header.test.tsx
git commit -m "feat(deveres): area do pai com formulario, grid e link no header"
```

---

## Task 14: Tela da criança (canvas animado + áudio)

**Files:**
- Create: `components/deveres/ControlesDever.tsx`
- Create: `components/deveres/TranscricaoDever.tsx`
- Create: `components/deveres/CanvasExplicacao.tsx`
- Create: `app/deveres/[id]/page.tsx`
- Test: `components/deveres/ControlesDever.test.tsx`

**Interfaces:**
- Consumes: `estadoDoPasso` de `lib/deveres/animacao`; `desenharFundo`/`desenharPrimitiva` de `lib/deveres/desenho`; `duracaoDoPasso`/`progressoDoPasso` de `lib/deveres/timeline`; `Cena` de `lib/deveres/cena`; `carregarAudioDever` de `lib/client/audio`; `DeverCompleto` de `lib/types`.
- Produces:
  - `ControlesDever` props `{ tocando: boolean; passoAtual: number; totalPassos: number; temTranscricao: boolean; onPlayPause: () => void; onAnterior: () => void; onProximo: () => void; onRepetir: () => void; onAbrirTranscricao: () => void }`
  - `TranscricaoDever` props `{ passos: { titulo: string; narracao: string }[] }`
  - `CanvasExplicacao` props `{ cena: Cena; duracaoMs: number; tocando: boolean; chaveReinicio: number; movimentoReduzido: boolean }`

- [ ] **Step 1: Escrever o teste que falha**

`components/deveres/ControlesDever.test.tsx`:

```tsx
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ControlesDever from '@/components/deveres/ControlesDever';

const props = () => ({
  tocando: false, passoAtual: 1, totalPassos: 3, temTranscricao: true,
  onPlayPause: vi.fn(), onAnterior: vi.fn(), onProximo: vi.fn(), onRepetir: vi.fn(),
  onAbrirTranscricao: vi.fn(),
});

afterEach(() => cleanup());

test('mostra o número do passo atual', () => {
  render(<ControlesDever {...props()} />);
  expect(screen.getByText('Passo 1 de 3')).toBeTruthy();
});

test('play dispara onPlayPause', () => {
  const p = props();
  render(<ControlesDever {...p} />);
  // Os regex aceitam o acento: o rótulo acessível é "Ouvir a explicação".
  fireEvent.click(screen.getByRole('button', { name: /ouvir a explica[cç]ao/i }));
  expect(p.onPlayPause).toHaveBeenCalledTimes(1);
});

test('repetir dispara onRepetir', () => {
  const p = props();
  render(<ControlesDever {...p} />);
  fireEvent.click(screen.getByRole('button', { name: /repetir este passo/i }));
  expect(p.onRepetir).toHaveBeenCalledTimes(1);
});

test('primeiro passo desabilita o botão anterior', () => {
  render(<ControlesDever {...props()} />);
  expect((screen.getByRole('button', { name: /passo anterior/i }) as HTMLButtonElement).disabled).toBe(true);
});

test('último passo desabilita o próximo', () => {
  render(<ControlesDever {...props()} passoAtual={3} />);
  expect((screen.getByRole('button', { name: /proximo passo/i }) as HTMLButtonElement).disabled).toBe(true);
});

test('abrir transcrição dispara onAbrirTranscricao', () => {
  const p = props();
  render(<ControlesDever {...p} />);
  fireEvent.click(screen.getByRole('button', { name: /ver texto/i }));
  expect(p.onAbrirTranscricao).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Rodar para confirmar a falha**

Run: `npx vitest run components/deveres/ControlesDever.test.tsx`
Expected: FAIL, módulo não resolve.

- [ ] **Step 3: Implementar os controles**

`components/deveres/ControlesDever.tsx`:

```tsx
'use client';

import { ChevronLeft, ChevronRight, FileText, Pause, Play, RotateCcw } from 'lucide-react';

interface Props {
  tocando: boolean;
  passoAtual: number;
  totalPassos: number;
  temTranscricao: boolean;
  onPlayPause: () => void;
  onAnterior: () => void;
  onProximo: () => void;
  onRepetir: () => void;
  onAbrirTranscricao: () => void;
}

export default function ControlesDever(p: Props) {
  return (
    <div className="card flex flex-wrap items-center gap-3">
      <p className="font-extrabold text-ink text-lg mr-auto" aria-live="polite">
        Passo {p.passoAtual} de {p.totalPassos}
      </p>

      <button type="button" onClick={p.onAnterior} disabled={p.passoAtual <= 1}
        className="btn-secondary !w-auto" aria-label="Passo anterior">
        <ChevronLeft size={22} aria-hidden="true" />
      </button>

      <button type="button" onClick={p.onPlayPause} className="btn-primary !w-auto !px-6"
        aria-label={p.tocando ? 'Pausar a explicação' : 'Ouvir a explicação'}>
        {p.tocando ? <Pause size={24} aria-hidden="true" /> : <Play size={24} aria-hidden="true" />}
      </button>

      <button type="button" onClick={p.onRepetir} className="btn-secondary !w-auto" aria-label="Repetir este passo">
        <RotateCcw size={22} aria-hidden="true" /> Repetir
      </button>

      <button type="button" onClick={p.onProximo} disabled={p.passoAtual >= p.totalPassos}
        className="btn-secondary !w-auto" aria-label="Próximo passo">
        <ChevronRight size={22} aria-hidden="true" />
      </button>

      {p.temTranscricao && (
        <button type="button" onClick={p.onAbrirTranscricao} className="btn-secondary !w-auto" aria-label="Ver texto da explicação">
          <FileText size={20} aria-hidden="true" /> Ver texto
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar para confirmar o passo**

Run: `npx vitest run components/deveres/ControlesDever.test.tsx`
Expected: PASS (6 testes).

- [ ] **Step 5: Implementar a transcrição**

`components/deveres/TranscricaoDever.tsx`:

```tsx
'use client';

interface Passo { titulo: string; narracao: string }

// O canvas é decorativo (aria-hidden). Esta é a alternativa textual equivalente,
// exigida para leitor de tela e para a criança que preferir ler.
export default function TranscricaoDever({ passos }: { passos: Passo[] }) {
  return (
    <ol className="space-y-4">
      {passos.map((p, i) => (
        <li key={i} className="card">
          <h3 className="font-extrabold text-ink text-lg mb-1">
            {i + 1}. {p.titulo}
          </h3>
          <p className="text-ink/80">{p.narracao}</p>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 6: Implementar o canvas**

`components/deveres/CanvasExplicacao.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import type { Cena } from '@/lib/deveres/cena';
import { estadoDoPasso } from '@/lib/deveres/animacao';
import { desenharFundo, desenharPrimitiva } from '@/lib/deveres/desenho';
import { progressoDoPasso } from '@/lib/deveres/timeline';

interface Props {
  cena: Cena;
  duracaoMs: number;
  tocando: boolean;
  // Mudar esta chave zera o relógio: é como "repetir este passo" refaz o desenho.
  chaveReinicio: number;
  movimentoReduzido: boolean;
}

export default function CanvasExplicacao({ cena, duracaoMs, tocando, chaveReinicio, movimentoReduzido }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inicioRef = useRef<number | null>(null);
  const acumuladoRef = useRef(0);

  useEffect(() => {
    acumuladoRef.current = 0;
    inicioRef.current = null;
  }, [chaveReinicio]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let quadro = 0;
    let anterior = 0;

    const pintar = () => {
      const dpr = window.devicePixelRatio || 1;
      const largura = canvas.clientWidth;
      const altura = canvas.clientHeight;
      // Canvas desfoca sem escalar o bitmap pelo DPR.
      if (canvas.width !== largura * dpr || canvas.height !== altura * dpr) {
        canvas.width = largura * dpr;
        canvas.height = altura * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      desenharFundo(ctx, cena.fundo, { largura, altura });
      const progresso = progressoDoPasso(acumuladoRef.current, duracaoMs);
      for (const item of estadoDoPasso(cena, progresso, movimentoReduzido)) {
        desenharPrimitiva(ctx, item, { largura, altura });
      }
    };

    const tick = (agora: number) => {
      if (tocando) {
        if (inicioRef.current === null) inicioRef.current = agora;
        acumuladoRef.current += agora - (anterior || agora);
      }
      anterior = agora;
      pintar();
      quadro = requestAnimationFrame(tick);
    };

    quadro = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(quadro);
  }, [cena, duracaoMs, tocando, movimentoReduzido]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="w-full rounded-3xl bg-white border-2 border-primary/15"
      style={{ aspectRatio: '4 / 3', touchAction: 'none' }}
    />
  );
}
```

- [ ] **Step 7: Implementar a página**

`app/deveres/[id]/page.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Frown } from 'lucide-react';
import Header from '@/components/Header';
import Mascote from '@/components/Mascote';
import CanvasExplicacao from '@/components/deveres/CanvasExplicacao';
import ControlesDever from '@/components/deveres/ControlesDever';
import TranscricaoDever from '@/components/deveres/TranscricaoDever';
import { tituloDoDever } from '@/components/deveres/DeverGrid';
import { apiFetch, lerToken } from '@/lib/client/api';
import { carregarAudioDever } from '@/lib/client/audio';
import { duracaoDoPasso } from '@/lib/deveres/timeline';
import type { Cena } from '@/lib/deveres/cena';
import type { DeverCompleto } from '@/lib/types';

export default function DeverDetalhe({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [dados, setDados] = useState<DeverCompleto | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [indice, setIndice] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [chaveReinicio, setChaveReinicio] = useState(0);
  const [mostrarTranscricao, setMostrarTranscricao] = useState(false);
  const [movimentoReduzido, setMovimentoReduzido] = useState(false);

  useEffect(() => {
    if (!lerToken()) {
      router.replace('/login');
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setMovimentoReduzido(mq.matches);
    const ouvir = (e: MediaQueryListEvent) => setMovimentoReduzido(e.matches);
    mq.addEventListener('change', ouvir);
    return () => mq.removeEventListener('change', ouvir);
  }, [router]);

  const carregar = useCallback(() => {
    apiFetch(`/api/dever/${params.id}`)
      .then(async (res) => {
        const corpo = await res.json();
        if (!res.ok) throw new Error(corpo.error ?? 'Não foi possível carregar o dever.');
        setDados(corpo);
      })
      .catch((err: Error) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [params.id]);

  useEffect(() => { carregar(); }, [carregar]);

  const passo = dados?.passos[indice] ?? null;
  const duracaoMs = useMemo(
    () => (passo ? duracaoDoPasso({ narracao: passo.narracao, duracao_ms: passo.duracao_ms }) : 0),
    [passo],
  );

  // Áudio: baixado autenticado e tocado por object URL. Guardado em ref para
  // revogar quando o passo muda ou o componente desmonta.
  useEffect(() => {
    if (!passo) return;
    let url: string | null = null;
    let audio: HTMLAudioElement | null = null;
    let cancelado = false;

    setTocando(false);
    setChaveReinicio((c) => c + 1);

    if (passo.audio_path) {
      carregarAudioDever(params.id, passo.ordem).then((u) => {
        if (cancelado || !u) return;
        url = u;
        audio = new Audio(u);
        audio.addEventListener('ended', () => setTocando(false));
        audio.play().then(() => setTocando(true)).catch(() => setTocando(false));
      });
    } else if (passo.duracao_ms === null) {
      // Sem áudio: o desenho roda pelo tempo estimado e para sozinho.
      setTocando(true);
      const t = setTimeout(() => setTocando(false), duracaoMs);
      return () => clearTimeout(t);
    }

    return () => {
      cancelado = true;
      if (audio) { audio.pause(); audio.src = ''; }
      if (url) URL.revokeObjectURL(url);
    };
  }, [params.id, indice, passo, duracaoMs]);

  // Atalhos de teclado: espaço e setas. A criança (e o pai) controla sem mouse.
  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); alternar(); }
      if (e.code === 'ArrowRight') irPara(indice + 1);
      if (e.code === 'ArrowLeft') irPara(indice - 1);
    };
    window.addEventListener('keydown', teclas);
    return () => window.removeEventListener('keydown', teclas);
  });

  function irPara(novo: number) {
    if (!dados || novo < 0 || novo >= dados.passos.length) return;
    setIndice(novo);
  }

  function alternar() {
    setTocando((atual) => !atual);
    setChaveReinicio((c) => c + 1);
  }

  if (carregando) {
    return (
      <>
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-8">
          <div className="card"><p className="text-2xl font-extrabold text-ink">Carregando o dever...</p></div>
        </main>
      </>
    );
  }

  if (erro || !dados || !passo) {
    return (
      <>
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="card text-center border-2 border-danger/40">
            <p className="text-2xl font-extrabold text-danger mb-4">
              <Frown size={32} className="inline mr-2" aria-hidden="true" /> {erro || 'Dever não encontrado'}
            </p>
            <Link href="/deveres" className="btn-primary !w-auto">Voltar para os deveres</Link>
          </div>
        </main>
      </>
    );
  }

  const cena = (passo.cena ?? { fundo: '#FDF6EC', primitivos: [] }) as Cena;

  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Mascote humor="feliz" className="w-12 h-12 shrink-0" decorative />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold text-primary truncate">{tituloDoDever(dados.dever)}</h1>
            <p className="text-ink/60 text-sm">{dados.dever.disciplina || 'Dever de casa'}</p>
          </div>
        </div>

        <p aria-live="polite" className="text-2xl font-extrabold text-ink">{passo.titulo}</p>

        <CanvasExplicacao
          cena={cena}
          duracaoMs={duracaoMs}
          tocando={tocando}
          chaveReinicio={chaveReinicio}
          movimentoReduzido={movimentoReduzido}
        />

        <ControlesDever
          tocando={tocando}
          passoAtual={indice + 1}
          totalPassos={dados.passos.length}
          temTranscricao
          onPlayPause={alternar}
          onAnterior={() => irPara(indice - 1)}
          onProximo={() => irPara(indice + 1)}
          onRepetir={() => setChaveReinicio((c) => c + 1)}
          onAbrirTranscricao={() => setMostrarTranscricao((v) => !v)}
        />

        {mostrarTranscricao && (
          <section aria-label="Texto da explicação">
            <TranscricaoDever passos={dados.passos} />
          </section>
        )}

        {dados.dever.resumo_para_pais && (
          <section className="card">
            <h2 className="font-extrabold text-ink mb-2">Para o responsável</h2>
            <p className="text-ink/70">{dados.dever.resumo_para_pais}</p>
          </section>
        )}

        <Link href="/deveres" className="btn-secondary !w-auto block text-center">Voltar para os deveres</Link>
      </main>
    </>
  );
}
```

- [ ] **Step 8: Typecheck e build**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm run build`
Expected: build conclui; as rotas `/deveres`, `/deveres/nova`, `/deveres/[id]` aparecem no log.

- [ ] **Step 9: Commit**

```bash
git add components/deveres app/deveres
git commit -m "feat(deveres): tela da crianca com canvas animado e audio"
```

---

## Task 15: Verificação manual e limpeza de uploads órfãos

**Files:**
- Create: `scripts/limpar-uploads-orfaos.ts`
- Modify: `package.json`
- Test: `test/unit/limpar-uploads.test.ts`

**Interfaces:**
- Consumes: `getPool` de `lib/db/pool.ts`, `fs.promises`, `node:path`.
- Produces: `function pastasOrfas(pastasNoDisco: string[], idsNoBanco: string[]): string[]` e o script executável `npm run limpar-uploads`.

- [ ] **Step 1: Escrever o teste que falha**

`test/unit/limpar-uploads.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pastasOrfas } from '@/scripts/limpar-uploads-orfaos';

describe('pastasOrfas', () => {
  it('aponta pasta sem linha em deveres', () => {
    expect(pastasOrfas(['a', 'b'], ['a'])).toEqual(['b']);
  });

  it('nada é órfão quando tudo tem linha', () => {
    expect(pastasOrfas(['a', 'b'], ['a', 'b'])).toEqual([]);
  });

  it('banco vazio torna tudo órfão', () => {
    expect(pastasOrfas(['a'], [])).toEqual(['a']);
  });

  it('ignora nomes de arquivo, só compara pastas', () => {
    expect(pastasOrfas(['a'], ['a'])).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar para confirmar a falha**

Run: `npx vitest run test/unit/limpar-uploads.test.ts`
Expected: FAIL, módulo não resolve.

- [ ] **Step 3: Implementar o script**

`scripts/limpar-uploads-orfaos.ts`:

```ts
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getPool } from '../lib/db/pool';

// O sistema de arquivos não entra na transação do Postgres. Se a criação do dever
// falhar depois da síntese, sobra pasta de WAV sem dono. Isto a remove.
export function pastasOrfas(pastasNoDisco: string[], idsNoBanco: string[]): string[] {
  const vivos = new Set(idsNoBanco);
  return pastasNoDisco.filter((p) => !vivos.has(p));
}

async function main(): Promise<void> {
  const raiz = path.join(process.cwd(), 'uploads', 'deveres');
  let pastas: string[] = [];
  try {
    pastas = (await fs.readdir(raiz, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    console.log('Sem uploads/deveres: nada a limpar.');
    return;
  }

  const { rows } = await getPool().query('SELECT id::text AS id FROM deveres');
  const vivos = rows.map((r) => r.id as string);
  const orfas = pastasOrfas(pastas, vivos);

  for (const pasta of orfas) {
    await fs.rm(path.join(raiz, pasta), { recursive: true, force: true });
    console.log(`Removida pasta órfã: ${pasta}`);
  }
  console.log(orfas.length ? `${orfas.length} pasta(s) removida(s).` : 'Nenhuma pasta órfã.');
}

if (process.argv[1] && process.argv[1].endsWith('limpar-uploads-orfaos.ts')) {
  main()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
}
```

Em `package.json`, em `scripts`, acrescentar:

```json
"limpar-uploads": "tsx scripts/limpar-uploads-orfaos.ts",
```

- [ ] **Step 4: Rodar para confirmar o passo**

Run: `npx vitest run test/unit/limpar-uploads.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Verificação manual (executar com o ambiente de dev de pé)**

Preparar: `npm run migrate`, subir o Postgres de dev, instalar o Piper e apontar `PIPER_BIN`/`PIPER_MODEL` no `.env`. Se o Piper não estiver disponível, rodar mesmo assim: o dever deve abrir com legendas e duração estimada.

Checklist a percorrer em `/deveres/nova`:

1. Enviar uma foto legível de um dever de matemática. Esperado: loading longo, depois `/deveres/<id>`.
2. Na tela da criança: o título do passo aparece, o canvas desenha as primitivas em sincronia com a voz, e nenhum número do exercício é falado. Conferir em pelo menos 3 passos.
3. "Repetir este passo": o desenho refaz idêntico e o áudio volta do início.
4. Setas do teclado e barra de espaço avançam/pausam.
5. "Ver texto" mostra a transcrição de todos os passos.
6. Com `prefers-reduced-motion: reduce` ativado no SO, as primitivas entram prontas e o áudio continua.
7. `/creditos` mostra o consumo do dever no extrato.
8. Rodar `npm run limpar-uploads` e confirmar que nada é removido quando todos os deveres existem.

Se algum item falhar, corrigir antes do commit.

- [ ] **Step 6: Suíte completa**

Run: `npm test && npm run test:db`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/limpar-uploads-orfaos.ts test/unit/limpar-uploads.test.ts package.json
git commit -m "chore(deveres): limpeza de uploads de audio orfaos"
```

---

## Notas de auto-revisão do plano

Cobertura da spec, conferida seção por seção:

- §3.1 rotas e Header → Tasks 10, 13, 14.
- §3.2 fluxo com transação, saldo e rollback → Task 9.
- §3.3 áudio no servidor → Tasks 6 e 9.
- §4 contrato do storyboard → Task 2.
- §4.1 vocabulário de cena e coordenadas normalizadas → Tasks 2 e 12.
- §4.2 anti-vazamento em duas camadas → Task 5.
- §5 renderizador, `estadoDoPasso` pura, duração real, fallback → Tasks 3, 4, 12, 14.
- §5.1 acessibilidade (`aria-hidden`, `aria-live`, transcrição, atalhos, `prefers-reduced-motion`) → Task 14.
- §6 schema e `movimentos_saldo.dever_id` → Tasks 1, 7, 8.
- §6.1 créditos → Tasks 8, 9, e verificação do extrato na Task 15.
- §6.2 áudio fora de `public/` com posse → Tasks 6, 10, 11.
- §7 arquivos novos → Tasks 2 a 14.
- §8 erros e degradação → Task 9 (402, 500, corrida, sem áudio) e Task 14 (fallback de legenda).
- §9 testes → todas as tasks com passo de teste; integração de LLM real fica fora do plano (a spec não a exige; `lib/deveres/llm.test.ts` é com mock).
- §10 riscos → latência tratada no texto de loading da Task 13; qualidade de visão e vocabulário visual são riscos aceitos, sem task.

Nada ficou como placeholder. Nomes conferidos entre tasks: `criarDever`, `criarPassos`, `getDeverPorChave`, `getDever`, `listarDeveresComResumo`, `getPassos`, `vincularMovimentoADever`, `gerarStoryboardSeguro`, `sintetizarPassos`, `caminhoDoAudio`, `piperDisponivel`, `duracaoDoPasso`, `progressoDoPasso`, `duracaoMsDoWav`, `estadoDoPasso`, `desenharFundo`, `desenharPrimitiva`, `carregarAudioDever`, `guardarTentativaDever`/`lerTentativaDever`/`limparTentativaDever`, `FRASE_NEUTRA`, `tituloDoDever`, `NovoDeverBotao`.
