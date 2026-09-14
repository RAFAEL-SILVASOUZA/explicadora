# Estudo com LLM para Crianças — Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistema web local que usa LLM multimodal para gerar questões de estudo a partir de conteúdo fornecido pelo pai, com feedback imediato e veredito final para crianças do 3º ao 9º ano.

**Architecture:** Next.js 14 App Router com API Routes no servidor. SQLite para persistência de sessões, questões e respostas. LLM acessada via API REST compatível com OpenAI. Frontend com Tailwind CSS, tema visual vibrante e letras grandes.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, better-sqlite3, pdf-parse, OpenAI-compatible API

**Spec:** `docs/superpowers/specs/2026-09-13-estudo-llm-criancas-design.md`

## Global Constraints

- LLM endpoint: `http://192.168.18.4:1234/v1` (compatível com OpenAI API)
- Sem login, sem segurança, uso local
- Sem testes automatizados
- Letras grandes: mínimo 24px para enunciados, 20px para opções
- Cores vibrantes, formas arredondadas, tema divertido
- Limiar de "preparado": 70% de acertos
- PDFs: extração de texto via `pdf-parse`
- Imagens: enviadas como base64 para a LLM multimodal

---

### Task 1: Scaffold do Projeto Next.js

**Files:**
- Create: `package.json`
- Create: `next.config.js`
- Create: `tsconfig.json`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/page.tsx`
- Create: `lib/db.ts`
- Create: `lib/llm.ts`
- Create: `lib/prompts.ts`
- Create: `lib/pdf.ts`
- Create: `uploads/.gitkeep`

**Interfaces:**
- Produces:
  - `lib/db.ts` exporta: `getDb(): Database`, `createSessao(conteudoTexto: string): string`, `getSessao(id: string): Sessao | null`, `getQuestoes(sessaoId: string): Questao[]`, `getRespostas(sessaoId: string): Resposta[]`, `createQuestoes(sessaoId: string, questoes: QuestaoInput[]): void`, `createResposta(questaoId: string, respostaDada: string, correto: boolean, explicacao: string): void`, `listarSessoes(): Sessao[]`, `getSessaoComQuestoes(id: string): SessaoCompleta | null`, `getScore(sessaoId: string): { acertos: number, total: number }`
  - `lib/llm.ts` exporta: `gerarQuestoes(conteudoTexto: string, imagensBase64: string[]): Promise<QuestaoLLM[]>`, `avaliarResposta(questao: QuestaoLLM, respostaDada: string): Promise<{ correto: boolean, explicacao: string }>`, `gerarVeredito(acertos: number, total: number, questoesErradas: QuestaoLLM[]): Promise<string>`
  - `lib/prompts.ts` exporta: `PROMPT_GERAR_QUESTOES`, `PROMPT_AVALIAR_RESPOSTA`, `PROMPT_VEREDITO`
  - `lib/pdf.ts` exporta: `extrairTextoPDF(buffer: Buffer): Promise<string>`
  - Tipos em `lib/types.ts`: `QuestaoLLM`, `Questao`, `Resposta`, `Sessao`, `SessaoCompleta`, `QuestaoInput`

- [ ] **Step 1: Criar package.json e instalar dependências**

```json
{
  "name": "estudo-llm-criancas",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "better-sqlite3": "^11.0.0",
    "pdf-parse": "^1.1.1"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/better-sqlite3": "^7.6.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

Run: `npm install`
Expected: `node_modules` criado, sem erros

- [ ] **Step 2: Criar next.config.js**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'pdf-parse'],
  },
};

module.exports = nextConfig;
```

- [ ] **Step 3: Criar tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Criar tailwind.config.js e postcss.config.js**

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',
        secondary: '#F59E0B',
        success: '#22C55E',
        danger: '#EF4444',
        bg: '#FEF9E7',
      },
      fontSize: {
        'enunciado': '1.5rem',
        'opcao': '1.25rem',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
```

```js
// postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Criar lib/types.ts**

```ts
export interface QuestaoLLM {
  tipo: 'multipla_escolha' | 'resposta_digitada';
  enunciado: string;
  opcoes: string[];
  resposta_correta: string;
}

export interface Questao {
  id: number;
  sessao_id: string;
  tipo: string;
  enunciado: string;
  opcoes_json: string;
  resposta_correta: string;
  ordem: number;
}

export interface Resposta {
  id: number;
  questao_id: number;
  resposta_dada: string;
  correto: number;
  explicacao: string;
  respondida_em: string;
}

export interface Sessao {
  id: string;
  conteudo_texto: string;
  criada_em: string;
}

export interface SessaoCompleta {
  sessao: Sessao;
  questoes: Questao[];
  respostas: Resposta[];
}

export interface QuestaoInput {
  tipo: string;
  enunciado: string;
  opcoes: string[];
  resposta_correta: string;
}
```

- [ ] **Step 6: Criar lib/db.ts**

```ts
import Database from 'better-sqlite3';
import path from 'path';
import { Sessao, Questao, Resposta, SessaoCompleta, QuestaoInput } from './types';

const DB_PATH = path.join(process.cwd(), 'data', 'estudo.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    db.exec(`
      CREATE TABLE IF NOT EXISTS sessoes (
        id TEXT PRIMARY KEY,
        conteudo_texto TEXT NOT NULL,
        criada_em TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS questoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessao_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        enunciado TEXT NOT NULL,
        opcoes_json TEXT NOT NULL DEFAULT '[]',
        resposta_correta TEXT NOT NULL,
        ordem INTEGER NOT NULL,
        FOREIGN KEY (sessao_id) REFERENCES sessoes(id)
      );
      CREATE TABLE IF NOT EXISTS respostas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        questao_id INTEGER NOT NULL,
        resposta_dada TEXT NOT NULL,
        correto INTEGER NOT NULL,
        explicacao TEXT NOT NULL,
        respondida_em TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (questao_id) REFERENCES questoes(id)
      );
    `);
  }
  return db;
}

export function createSessao(conteudoTexto: string): string {
  const id = crypto.randomUUID();
  const db = getDb();
  db.prepare('INSERT INTO sessoes (id, conteudo_texto) VALUES (?, ?)').run(id, conteudoTexto);
  return id;
}

export function getSessao(id: string): Sessao | null {
  const db = getDb();
  return db.prepare('SELECT * FROM sessoes WHERE id = ?').get(id) as Sessao | null;
}

export function getQuestoes(sessaoId: string): Questao[] {
  const db = getDb();
  return db.prepare('SELECT * FROM questoes WHERE sessao_id = ? ORDER BY ordem').all(sessaoId) as Questao[];
}

export function getRespostas(sessaoId: string): Resposta[] {
  const db = getDb();
  return db.prepare(`
    SELECT r.* FROM respostas r
    JOIN questoes q ON r.questao_id = q.id
    WHERE q.sessao_id = ?
  `).all(sessaoId) as Resposta[];
}

export function createQuestoes(sessaoId: string, questoes: QuestaoInput[]): void {
  const db = getDb();
  const insert = db.prepare('INSERT INTO questoes (sessao_id, tipo, enunciado, opcoes_json, resposta_correta, ordem) VALUES (?, ?, ?, ?, ?, ?)');
  questoes.forEach((q, i) => {
    insert.run(sessaoId, q.tipo, q.enunciado, JSON.stringify(q.opcoes), q.resposta_correta, i + 1);
  });
}

export function createResposta(questaoId: string, respostaDada: string, correto: boolean, explicacao: string): void {
  const db = getDb();
  db.prepare('INSERT INTO respostas (questao_id, resposta_dada, correto, explicacao) VALUES (?, ?, ?, ?)').run(
    questaoId, respostaDada, correto ? 1 : 0, explicacao
  );
}

export function listarSessoes(): Sessao[] {
  const db = getDb();
  return db.prepare('SELECT * FROM sessoes ORDER BY criada_em DESC').all() as Sessao[];
}

export function getSessaoComQuestoes(id: string): SessaoCompleta | null {
  const sessao = getSessao(id);
  if (!sessao) return null;
  return {
    sessao,
    questoes: getQuestoes(id),
    respostas: getRespostas(id),
  };
}

export function getScore(sessaoId: string): { acertos: number; total: number } {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as c FROM questoes WHERE sessao_id = ?').get(sessaoId) as { c: number }).c;
  const acertos = (db.prepare(`
    SELECT COUNT(*) as c FROM respostas r
    JOIN questoes q ON r.questao_id = q.id
    WHERE q.sessao_id = ? AND r.correto = 1
  `).get(sessaoId) as { c: number }).c;
  return { acertos, total };
}
```

- [ ] **Step 7: Criar lib/prompts.ts**

```ts
export const PROMPT_GERAR_QUESTOES = `Você é um professor que cria questões de estudo para crianças do 3º ao 9º ano.

Com base no conteúdo fornecido, gere questões para o aluno praticar.

Regras:
- Gere entre 5 e 10 questões.
- Misture tipos: algumas de múltipla escolha (4 opções) e algumas de resposta digitada.
- A dificuldade deve ser adequada para o nível escolar.
- As questões devem cobrir o conteúdo fornecido.
- Para múltipla escolha, a resposta correta deve estar entre as opções.
- Para resposta digitada, a resposta correta deve ser curta (1-3 palavras ou um número).

Responda APENAS com um array JSON válido, sem markdown, sem texto extra. Formato:
[
  {
    "tipo": "multipla_escolha",
    "enunciado": "Texto da pergunta",
    "opcoes": ["Opção A", "Opção B", "Opção C", "Opção D"],
    "resposta_correta": "Opção A"
  },
  {
    "tipo": "resposta_digitada",
    "enunciado": "Texto da pergunta",
    "opcoes": [],
    "resposta_correta": "resposta curta"
  }
]`;

export const PROMPT_AVALIAR_RESPOSTA = `Você é um professor avaliando a resposta de uma criança.

Questão: ${'{{ENUNCIADO}}'}
${'{{OPCOES}}'}
Resposta correta: ${'{{RESPOSTA_CORRETA}}'}
Resposta do aluno: ${'{{RESPOSTA_ALUNO}}'}

Avalie se a resposta do aluno está correta. Seja flexível com variações de escrita e pontuação.

Responda APENAS com JSON válido, sem markdown:
{
  "correto": true,
  "explicacao": "Explicação curta e amigável. Se estiver errado, explique o porquê e dê a resposta certa. Se estiver certo, elogie brevemente."
}`;

export const PROMPT_VEREDITO = `Você é um professor avaliando o desempenho de uma criança que está se preparando para uma prova.

Desempenho: ${'{{ACERTOS}}'} de ${'{{TOTAL}}'} questões corretas (${'{{PERCENTUAL}}'}%).

${'{{QUESTOES_ERRADAS}}'}

Avalie se o aluno está preparado para a prova (limiar: 70% de acertos).
Seja amigável e encorajador. Se não estiver preparado, diga o que revisar.
Se estiver preparado, celebre a conquista.

Responda em português, de forma amigável e curta (máximo 5 frases).`;
```

- [ ] **Step 8: Criar lib/llm.ts**

```ts
import { QuestaoLLM } from './types';
import { PROMPT_GERAR_QUESTOES, PROMPT_AVALIAR_RESPOSTA, PROMPT_VEREDITO } from './prompts';

const LLM_BASE_URL = 'http://192.168.18.4:1234/v1';
const LLM_MODEL = 'local-model';

async function callLLM(messages: any[]): Promise<string> {
  const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: LLM_MODEL, messages }),
  });
  if (!res.ok) throw new Error(`LLM error: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

function parseJSON<T>(text: string): T {
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned) as T;
}

export async function gerarQuestoes(conteudoTexto: string, imagensBase64: string[]): Promise<QuestaoLLM[]> {
  const userContent: any[] = [];

  if (conteudoTexto) {
    userContent.push({ type: 'text', text: `Conteúdo para as questões:\n\n${conteudoTexto}` });
  }

  for (const img of imagensBase64) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${img}` },
    });
  }

  const messages = [
    { role: 'system', content: PROMPT_GERAR_QUESTOES },
    { role: 'user', content: userContent },
  ];

  const response = await callLLM(messages);
  return parseJSON<QuestaoLLM[]>(response);
}

export async function avaliarResposta(questao: QuestaoLLM, respostaDada: string): Promise<{ correto: boolean; explicacao: string }> {
  const opcoesTexto = questao.opcoes.length > 0
    ? `Opções:\n${questao.opcoes.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n')}`
    : '';

  const prompt = PROMPT_AVALIAR_RESPOSTA
    .replace('{{ENUNCIADO}}', questao.enunciado)
    .replace('{{OPCOES}}', opcoesTexto)
    .replace('{{RESPOSTA_CORRETA}}', questao.resposta_correta)
    .replace('{{RESPOSTA_ALUNO}}', respostaDada);

  const messages = [
    { role: 'system', content: 'Você é um professor. Responda apenas JSON válido.' },
    { role: 'user', content: prompt },
  ];

  const response = await callLLM(messages);
  return parseJSON<{ correto: boolean; explicacao: string }>(response);
}

export async function gerarVeredito(acertos: number, total: number, questoesErradas: QuestaoLLM[]): Promise<string> {
  const percentual = total > 0 ? Math.round((acertos / total) * 100) : 0;
  const errosTexto = questoesErradas.length > 0
    ? `Questões erradas:\n${questoesErradas.map((q, i) => `${i + 1}. ${q.enunciado} (resposta correta: ${q.resposta_correta})`).join('\n')}`
    : 'Nenhuma questão errada!';

  const prompt = PROMPT_VEREDITO
    .replace('{{ACERTOS}}', String(acertos))
    .replace('{{TOTAL}}', String(total))
    .replace('{{PERCENTUAL}}', String(percentual))
    .replace('{{QUESTOES_ERRADAS}}', errosTexto);

  const messages = [
    { role: 'system', content: 'Você é um professor amigável. Responda em português.' },
    { role: 'user', content: prompt },
  ];

  return callLLM(messages);
}
```

- [ ] **Step 9: Criar lib/pdf.ts**

```ts
import pdf from 'pdf-parse';

export async function extrairTextoPDF(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text;
}
```

- [ ] **Step 10: Criar app/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #FEF9E7;
}
```

- [ ] **Step 11: Criar app/layout.tsx**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Estudo Divertido',
  description: 'Sistema de estudo com LLM para crianças',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-bg">{children}</body>
    </html>
  );
}
```

- [ ] **Step 12: Criar app/page.tsx (placeholder)**

```tsx
export default function Home() {
  return (
    <main className="flex items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold text-primary">Estudo Divertido</h1>
    </main>
  );
}
```

- [ ] **Step 13: Criar uploads/.gitkeep**

Arquivo vazio.

- [ ] **Step 14: Verificar build**

Run: `npm run build`
Expected: Build concluído sem erros

---

### Task 2: API Routes

**Files:**
- Create: `app/api/revisao/route.ts`
- Create: `app/api/revisao/[id]/route.ts`
- Create: `app/api/revisao/[id]/responder/route.ts`
- Create: `app/api/revisao/[id]/finalizar/route.ts`

**Interfaces:**
- Consumes: `lib/db.ts` (createSessao, createQuestoes, getSessaoComQuestoes, createResposta, getScore, getQuestoes), `lib/llm.ts` (gerarQuestoes, avaliarResposta, gerarVeredito), `lib/pdf.ts` (extrairTextoPDF), `lib/types.ts`
- Produces:
  - `POST /api/revisao` → `{ id: string }` ou `{ error: string }`
  - `GET /api/revisao/[id]` → `{ sessao, questoes, respostas }` ou `{ error: string }`
  - `POST /api/revisao/[id]/responder` → `{ correto, explicacao, questaoAtual, questoesRestantes }` ou `{ error: string }`
  - `POST /api/revisao/[id]/finalizar` → `{ veredito, acertos, total, percentual }` ou `{ error: string }`

- [ ] **Step 1: Criar app/api/revisao/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createSessao, createQuestoes } from '@/lib/db';
import { gerarQuestoes } from '@/lib/llm';
import { extrairTextoPDF } from '@/lib/pdf';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const texto = (formData.get('texto') as string) || '';
    const files = formData.getAll('arquivos') as File[];

    let conteudoCompleto = texto;
    const imagensBase64: string[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'pdf') {
        try {
          const pdfTexto = await extrairTextoPDF(buffer);
          conteudoCompleto += `\n\n--- Conteúdo do PDF: ${file.name} ---\n${pdfTexto}`;
        } catch {
          // PDF ilegível, continua
        }
      } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) {
        const base64 = buffer.toString('base64');
        imagensBase64.push(base64);
        const uploadPath = path.join(process.cwd(), 'uploads', file.name);
        fs.writeFileSync(uploadPath, buffer);
      }
    }

    if (!conteudoCompleto.trim() && imagensBase64.length === 0) {
      return NextResponse.json({ error: 'Forneça texto ou arquivos.' }, { status: 400 });
    }

    const questoes = await gerarQuestoes(conteudoCompleto, imagensBase64);
    const id = createSessao(conteudoCompleto);
    createQuestoes(id, questoes);

    return NextResponse.json({ id });
  } catch (err: any) {
    return NextResponse.json({ error: 'Não consegui falar com o professor. Tente novamente.' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Criar app/api/revisao/[id]/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessaoComQuestoes } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const data = getSessaoComQuestoes(params.id);
  if (!data) {
    return NextResponse.json({ error: 'Essa revisão não existe mais.' }, { status: 404 });
  }
  return NextResponse.json(data);
}
```

- [ ] **Step 3: Criar app/api/revisao/[id]/responder/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessaoComQuestoes, createResposta, getQuestoes } from '@/lib/db';
import { avaliarResposta } from '@/lib/llm';
import { QuestaoLLM } from '@/lib/types';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { questaoId, resposta } = body as { questaoId: number; resposta: string };

    const data = getSessaoComQuestoes(params.id);
    if (!data) {
      return NextResponse.json({ error: 'Essa revisão não existe mais.' }, { status: 404 });
    }

    const questao = data.questoes.find(q => q.id === questaoId);
    if (!questao) {
      return NextResponse.json({ error: 'Questão não encontrada.' }, { status: 404 });
    }

    const questaoLLM: QuestaoLLM = {
      tipo: questao.tipo as QuestaoLLM['tipo'],
      enunciado: questao.enunciado,
      opcoes: JSON.parse(questao.opcoes_json),
      resposta_correta: questao.resposta_correta,
    };

    const { correto, explicacao } = await avaliarResposta(questaoLLM, resposta);
    createResposta(String(questao.id), resposta, correto, explicacao);

    const questoes = getQuestoes(params.id);
    const indiceAtual = questoes.findIndex(q => q.id === questaoId);
    const questoesRestantes = questoes.length - indiceAtual - 1;

    return NextResponse.json({
      correto,
      explicacao,
      questaoAtual: indiceAtual + 1,
      questoesRestantes,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Não consegui falar com o professor. Tente novamente.' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Criar app/api/revisao/[id]/finalizar/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessaoComQuestoes, getScore } from '@/lib/db';
import { gerarVeredito } from '@/lib/llm';
import { QuestaoLLM } from '@/lib/types';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data = getSessaoComQuestoes(params.id);
    if (!data) {
      return NextResponse.json({ error: 'Essa revisão não existe mais.' }, { status: 404 });
    }

    const { acertos, total } = getScore(params.id);
    const percentual = total > 0 ? Math.round((acertos / total) * 100) : 0;

    const questoesErradas: QuestaoLLM[] = [];
    for (const q of data.questoes) {
      const r = data.respostas.find(r => r.questao_id === q.id);
      if (r && !r.correto) {
        questoesErradas.push({
          tipo: q.tipo as QuestaoLLM['tipo'],
          enunciado: q.enunciado,
          opcoes: JSON.parse(q.opcoes_json),
          resposta_correta: q.resposta_correta,
        });
      }
    }

    const veredito = await gerarVeredito(acertos, total, questoesErradas);

    return NextResponse.json({ veredito, acertos, total, percentual });
  } catch (err: any) {
    return NextResponse.json({ error: 'Não consegui falar com o professor. Tente novamente.' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Verificar build**

Run: `npm run build`
Expected: Build concluído sem erros

---

### Task 3: Componentes de UI

**Files:**
- Create: `components/ProgressoBarra.tsx`
- Create: `components/QuestaoCard.tsx`
- Create: `components/FeedbackResposta.tsx`
- Create: `components/LoadingQuestoes.tsx`

**Interfaces:**
- Consumes: `lib/types.ts` (Questao, QuestaoLLM)
- Produces:
  - `ProgressoBarra({ atual, total }: { atual: number; total: number })`
  - `QuestaoCard({ questao, onResponder }: { questao: Questao; onResponder: (resposta: string) => void })`
  - `FeedbackResposta({ correto, explicacao, onProxima }: { correto: boolean; explicacao: string; onProxima: () => void })`
  - `LoadingQuestoes()`

- [ ] **Step 1: Criar components/ProgressoBarra.tsx**

```tsx
export default function ProgressoBarra({ atual, total }: { atual: number; total: number }) {
  const percentual = total > 0 ? (atual / total) * 100 : 0;
  return (
    <div className="w-full mb-6">
      <div className="flex justify-between text-lg font-semibold text-gray-700 mb-2">
        <span>Questão {atual} de {total}</span>
        <span>{Math.round(percentual)}%</span>
      </div>
      <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${percentual}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar components/QuestaoCard.tsx**

```tsx
'use client';

import { useState } from 'react';
import { Questao } from '@/lib/types';

export default function QuestaoCard({ questao, onResponder }: { questao: Questao; onResponder: (resposta: string) => void }) {
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [digitada, setDigitada] = useState('');

  const opcoes = JSON.parse(questao.opcoes_json) as string[];
  const isMultipla = questao.tipo === 'multipla_escolha';

  const handleResponder = () => {
    const resposta = isMultipla ? selecionada : digitada;
    if (resposta) onResponder(resposta);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 max-w-2xl mx-auto">
      <h2 className="text-enunciado font-bold text-gray-800 mb-6">{questao.enunciado}</h2>

      {isMultipla ? (
        <div className="space-y-3 mb-6">
          {opcoes.map((opcao, i) => (
            <button
              key={i}
              onClick={() => setSelecionada(opcao)}
              className={`w-full text-left text-opcao p-4 rounded-xl border-2 transition-all ${
                selecionada === opcao
                  ? 'border-primary bg-blue-50 text-primary font-bold'
                  : 'border-gray-200 hover:border-primary hover:bg-blue-50'
              }`}
            >
              <span className="font-bold mr-2">{String.fromCharCode(65 + i)})</span>
              {opcao}
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-6">
          <input
            type="text"
            value={digitada}
            onChange={(e) => setDigitada(e.target.value)}
            placeholder="Digite sua resposta..."
            className="w-full text-opcao p-4 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none"
          />
        </div>
      )}

      <button
        onClick={handleResponder}
        disabled={!respostaValida()}
        className="w-full bg-primary text-white text-xl font-bold py-4 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Responder
      </button>
    </div>
  );

  function respostaValida() {
    return isMultipla ? selecionada !== null : digitada.trim().length > 0;
  }
}
```

- [ ] **Step 3: Criar components/FeedbackResposta.tsx**

```tsx
export default function FeedbackResposta({ correto, explicacao, onProxima }: { correto: boolean; explicacao: string; onProxima: () => void }) {
  return (
    <div className={`rounded-2xl shadow-lg p-8 max-w-2xl mx-auto ${correto ? 'bg-green-50 border-2 border-green-300' : 'bg-red-50 border-2 border-red-300'}`}>
      <div className="text-5xl mb-4">{correto ? '🎉' : '📚'}</div>
      <h2 className={`text-2xl font-bold mb-4 ${correto ? 'text-green-700' : 'text-red-700'}`}>
        {correto ? 'Muito bem!' : 'Quase lá!'}
      </h2>
      <p className="text-xl text-gray-700 mb-6">{explicacao}</p>
      <button
        onClick={onProxima}
        className="w-full bg-primary text-white text-xl font-bold py-4 rounded-xl hover:bg-blue-600 transition-colors"
      >
        Próxima Questão →
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Criar components/LoadingQuestoes.tsx**

```tsx
export default function LoadingQuestoes() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-6xl mb-6 animate-bounce">🤖</div>
      <h2 className="text-2xl font-bold text-gray-700 mb-2">O professor está preparando as questões...</h2>
      <p className="text-lg text-gray-500">Isso pode levar alguns segundos</p>
      <div className="mt-6 flex gap-2">
        <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
        <div className="w-3 h-3 bg-secondary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
        <div className="w-3 h-3 bg-success rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verificar build**

Run: `npm run build`
Expected: Build concluído sem erros

---

### Task 4: Páginas do Frontend

**Files:**
- Modify: `app/page.tsx`
- Create: `app/revisao/page.tsx`
- Create: `app/estudar/[id]/page.tsx`
- Create: `app/resultado/[id]/page.tsx`

**Interfaces:**
- Consumes: `components/ProgressoBarra`, `components/QuestaoCard`, `components/FeedbackResposta`, `components/LoadingQuestoes`, `lib/types.ts`
- Produces: Páginas completas funcionais

- [ ] **Step 1: Modificar app/page.tsx (Home)**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sessao } from '@/lib/types';

export default function Home() {
  const router = useRouter();
  const [sessoes, setSessoes] = useState<Sessao[]>([]);

  useEffect(() => {
    fetch('/api/sessoes')
      .then(r => r.json())
      .then(setSessoes)
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold text-primary mb-4">📚 Estudo Divertido</h1>
      <p className="text-xl text-gray-600 mb-8">Aprenda brincando com o professor virtual!</p>

      <button
        onClick={() => router.push('/revisao')}
        className="bg-primary text-white text-2xl font-bold px-12 py-6 rounded-2xl hover:bg-blue-600 transition-colors shadow-lg mb-12"
      >
        ✏️ Criar Revisão
      </button>

      {sessoes.length > 0 && (
        <div className="w-full max-w-md">
          <h2 className="text-xl font-bold text-gray-700 mb-4">Revisões anteriores</h2>
          <div className="space-y-3">
            {sessoes.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/estudar/${s.id}`)}
                className="w-full text-left bg-white p-4 rounded-xl shadow hover:shadow-md transition-shadow"
              >
                <p className="font-semibold text-gray-800 truncate">{s.conteudo_texto.slice(0, 60)}...</p>
                <p className="text-sm text-gray-500">{new Date(s.criada_em).toLocaleDateString('pt-BR')}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Criar app/api/sessoes/route.ts**

```ts
import { NextResponse } from 'next/server';
import { listarSessoes } from '@/lib/db';

export async function GET() {
  const sessoes = listarSessoes();
  return NextResponse.json(sessoes);
}
```

- [ ] **Step 3: Criar app/revisao/page.tsx**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingQuestoes from '@/components/LoadingQuestoes';

export default function RevisaoPage() {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro('');

    const formData = new FormData();
    formData.append('texto', texto);
    for (const file of arquivos) {
      formData.append('arquivos', file);
    }

    try {
      const res = await fetch('/api/revisao', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/estudar/${data.id}`);
    } catch (err: any) {
      setErro(err.message || 'Algo deu errado. Tente novamente.');
      setCarregando(false);
    }
  };

  if (carregando) return <LoadingQuestoes />;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-primary mb-6">📝 Criar Revisão</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xl font-semibold text-gray-700 mb-2">Conteúdo da revisão</label>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Cole aqui o conteúdo que quer revisar..."
              className="w-full h-48 text-lg p-4 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xl font-semibold text-gray-700 mb-2">Imagens e PDFs (opcional)</label>
            <input
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.webp,.pdf"
              onChange={(e) => setArquivos(Array.from(e.target.files || []))}
              className="w-full text-lg p-4 rounded-xl border-2 border-dashed border-gray-300 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:bg-primary file:text-white file:font-semibold file:text-lg hover:file:bg-blue-600 cursor-pointer"
            />
            {arquivos.length > 0 && (
              <p className="text-gray-500 mt-2">{arquivos.length} arquivo(s) selecionado(s)</p>
            )}
          </div>

          {erro && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 text-red-700 text-lg">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={!texto.trim() && arquivos.length === 0}
            className="w-full bg-primary text-white text-xl font-bold py-4 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🚀 Gerar Questões
          </button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Criar app/estudar/[id]/page.tsx**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProgressoBarra from '@/components/ProgressoBarra';
import QuestaoCard from '@/components/QuestaoCard';
import FeedbackResposta from '@/components/FeedbackResposta';
import { Questao, Resposta } from '@/lib/types';

export default function EstudarPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [feedback, setFeedback] = useState<{ correto: boolean; explicacao: string } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    fetch(`/api/revisao/${params.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setQuestoes(data.questoes);
        setRespostas(data.respostas);
        const respondidas = data.respostas.length;
        if (respondidas >= data.questoes.length) {
          router.push(`/resultado/${params.id}`);
        } else {
          setIndiceAtual(respondidas);
        }
      })
      .catch(err => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [params.id, router]);

  const handleResponder = async (resposta: string) => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/revisao/${params.id}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questaoId: questoes[indiceAtual].id, resposta }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFeedback({ correto: data.correto, explicacao: data.explicacao });
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  const handleProxima = () => {
    setFeedback(null);
    const proximo = indiceAtual + 1;
    if (proximo >= questoes.length) {
      router.push(`/resultado/${params.id}`);
    } else {
      setIndiceAtual(proximo);
    }
  };

  if (carregando && questoes.length === 0) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-2xl">Carregando...</p></div>;
  }

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-8 max-w-md text-center">
          <p className="text-2xl mb-4">😢 {erro}</p>
          <button onClick={() => router.push('/')} className="bg-primary text-white px-6 py-3 rounded-xl text-lg">
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <ProgressoBarra atual={indiceAtual + 1} total={questoes.length} />
        {feedback ? (
          <FeedbackResposta correto={feedback.correto} explicacao={feedback.explicacao} onProxima={handleProxima} />
        ) : (
          <QuestaoCard questao={questoes[indiceAtual]} onResponder={handleResponder} />
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Criar app/resultado/[id]/page.tsx**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Resultado {
  veredito: string;
  acertos: number;
  total: number;
  percentual: number;
}

export default function ResultadoPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch(`/api/revisao/${params.id}/finalizar`, { method: 'POST' })
      .then(r => r.json())
      .then(setResultado)
      .catch(err => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [params.id]);

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🏆</div>
          <p className="text-2xl">Calculando resultado...</p>
        </div>
      </div>
    );
  }

  if (erro || !resultado) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-8 max-w-md text-center">
          <p className="text-2xl mb-4">😢 {erro || 'Erro ao carregar resultado'}</p>
          <button onClick={() => router.push('/')} className="bg-primary text-white px-6 py-3 rounded-xl text-lg">
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  const preparado = resultado.percentual >= 70;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto text-center">
        <div className="text-7xl mb-6">{preparado ? '🏆' : '💪'}</div>
        <h1 className="text-4xl font-bold text-primary mb-4">
          {preparado ? 'Você está preparado!' : 'Continue praticando!'}
        </h1>

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="text-6xl font-bold text-gray-800 mb-2">{resultado.percentual}%</div>
          <p className="text-xl text-gray-600">
            {resultado.acertos} de {resultado.total} questões corretas
          </p>
        </div>

        <div className={`rounded-2xl p-8 mb-6 ${preparado ? 'bg-green-50 border-2 border-green-300' : 'bg-amber-50 border-2 border-amber-300'}`}>
          <h2 className="text-2xl font-bold mb-4">📋 O que o professor diz:</h2>
          <p className="text-xl text-gray-700">{resultado.veredito}</p>
        </div>

        <button
          onClick={() => router.push('/')}
          className="bg-primary text-white text-xl font-bold px-12 py-4 rounded-xl hover:bg-blue-600 transition-colors"
        >
          Voltar ao Início
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Verificar build**

Run: `npm run build`
Expected: Build concluído sem erros

---

### Task 5: Verificação Final

**Files:**
- Nenhum arquivo novo. Verificação do sistema completo.

**Interfaces:**
- Consumes: Todos os arquivos das Tasks 1-4

- [ ] **Step 1: Iniciar servidor de desenvolvimento**

Run: `npm run dev` (em background)
Expected: Servidor rodando em `http://localhost:3000`

- [ ] **Step 2: Verificar página inicial**

Navegar para `http://localhost:3000`
Expected: Título "Estudo Divertido", botão "Criar Revisão" visível

- [ ] **Step 3: Verificar página de revisão**

Navegar para `http://localhost:3000/revisao`
Expected: Textarea para texto, input de arquivos, botão "Gerar Questões"

- [ ] **Step 4: Testar criação de revisão (se LLM disponível)**

Colar texto no textarea, clicar "Gerar Questões"
Expected: Loading spinner, depois redirecionamento para `/estudar/[id]`

- [ ] **Step 5: Verificar página de estudo**

Navegar para a página de estudo gerada
Expected: Barra de progresso, questão com letras grandes, botões de opção ou input

- [ ] **Step 6: Verificar página de resultado**

Navegar para a página de resultado
Expected: Score, veredito, botão voltar

- [ ] **Step 7: Parar servidor**

Parar o processo de desenvolvimento.
