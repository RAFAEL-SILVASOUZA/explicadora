import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { QuestaoLLM } from './types';
import { PROMPT_GERAR_QUESTOES, PROMPT_AVALIAR_RESPOSTA, PROMPT_VEREDITO } from './prompts';

export interface ImagemProcessada {
  base64: string;
  mime: string;
}

const LLM_BASE_URL = process.env.LLM_BASE_URL || 'http://192.168.18.4:1234/v1';
const LLM_MODEL = process.env.LLM_MODEL || 'local-model';
const LLM_API_KEY = process.env.LLM_API_KEY || 'local';

const MAX_TENTATIVAS_LLM = 3;

// Servidor local compatível com a API Chat Completions da OpenAI.
// withStructuredOutput transforma o schema zod em tool (tool calling):
// o modelo devolve dados já validados contra o schema, sem parse JSON manual.
const llm = new ChatOpenAI({
  model: LLM_MODEL,
  apiKey: LLM_API_KEY,
  configuration: { baseURL: LLM_BASE_URL },
});

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// O servidor de LLM local às vezes derruba a conexão no meio da requisição
// (ex.: sobrecarga processando imagem). Tenta de novo antes de desistir.
async function comRetry<T>(executar: () => Promise<T>): Promise<T> {
  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS_LLM; tentativa++) {
    try {
      return await executar();
    } catch (e) {
      ultimoErro = e;
      if (tentativa < MAX_TENTATIVAS_LLM - 1) {
        await esperar(500 * (tentativa + 1));
      }
    }
  }
  throw ultimoErro;
}

// ---------- Schemas (used as tools for structured output) ----------

const QuestaoSchema = z.object({
  tipo: z.enum(['multipla_escolha', 'resposta_digitada']),
  enunciado: z.string(),
  opcoes: z.array(z.string()),
  resposta_correta: z.string(),
  dica: z.string(),
});

const GerarQuestoesSchema = z.object({
  questoes: z.array(QuestaoSchema),
});

const AvaliarRespostaSchema = z.object({
  correto: z.boolean(),
  explicacao: z.string(),
});

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

function embaralhar<T>(itens: T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// LLMs tendem a colocar a resposta certa sempre na mesma posição (viés de
// posição, reforçado pelo próprio exemplo do prompt). Embaralhamos aqui para
// a letra mostrada ao aluno não ficar sempre em A/B/etc.
export function embaralharOpcoes(questoes: QuestaoLLM[]): QuestaoLLM[] {
  return questoes.map((q) =>
    q.tipo === 'multipla_escolha' ? { ...q, opcoes: embaralhar(q.opcoes) } : q
  );
}

// Rede de segurança: pega o caso (comum em LLMs locais menores) em que o modelo
// ignora a instrução do prompt e cola a resposta dentro da própria dica.
function dicaRevelaResposta(dica: string, respostaCorreta: string): boolean {
  const respostaNorm = normalizar(respostaCorreta);
  if (respostaNorm.length < 3) return false; // respostas curtas demais geram falso positivo
  const dicaNorm = normalizar(dica);
  const regex = new RegExp(`\\b${respostaNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  return regex.test(dicaNorm);
}

export async function gerarQuestoes(conteudoTexto: string, imagens: ImagemProcessada[]): Promise<QuestaoLLM[]> {
  const userContent: any[] = [];

  if (conteudoTexto) {
    userContent.push({ type: 'text', text: `Conteúdo para as questões:\n\n${conteudoTexto}` });
  }

  for (const img of imagens) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${img.mime};base64,${img.base64}` },
    });
  }

  const llmQuestoes = llm.withStructuredOutput(GerarQuestoesSchema, {
    name: 'gerar_questoes',
  });

  const messages = [
    { role: 'system', content: PROMPT_GERAR_QUESTOES },
    { role: 'user', content: userContent },
  ];

  // Retries em caso de falha na chamada (comum quando há muitas imagens) ou de
  // dica que revela a resposta (comum em LLMs locais menores).
  const MAX_TENTATIVAS = 3;
  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
    const { questoes } = await comRetry(() => llmQuestoes.invoke(messages as any));
    if (Array.isArray(questoes) && questoes.length > 0) {
      const comDica = questoes.map((q) => ({ ...q, dica: q.dica || '' }));
      const algumaDicaVaza = comDica.some((q) => dicaRevelaResposta(q.dica, q.resposta_correta));

      if (!algumaDicaVaza) return embaralharOpcoes(comDica);

      if (tentativa < MAX_TENTATIVAS - 1) {
        ultimoErro = new Error('Dica revelou a resposta');
        continue;
      }

      // Última tentativa: em vez de descartar questões boas, some só a dica que vazou.
      const semDicaVazada = comDica.map((q) =>
        dicaRevelaResposta(q.dica, q.resposta_correta) ? { ...q, dica: '' } : q
      );
      return embaralharOpcoes(semDicaVazada);
    }
    ultimoErro = new Error('LLM retornou lista vazia');
  }
  throw ultimoErro ?? new Error('Falha ao gerar questões');
}

export async function avaliarResposta(questao: QuestaoLLM, respostaDada: string, imagem?: string): Promise<{ correto: boolean; explicacao: string }> {
  const opcoesTexto = questao.opcoes.length > 0
    ? `Opções:\n${questao.opcoes.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n')}`
    : '';

  const prompt = PROMPT_AVALIAR_RESPOSTA
    .replace('{{ENUNCIADO}}', questao.enunciado)
    .replace('{{OPCOES}}', opcoesTexto)
    .replace('{{RESPOSTA_CORRETA}}', questao.resposta_correta)
    .replace('{{RESPOSTA_ALUNO}}', respostaDada);

  const userContent: any[] = [];

  if (imagem) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${imagem}` },
    });
  }

  userContent.push({ type: 'text', text: prompt });

  const llmAvalia = llm.withStructuredOutput(AvaliarRespostaSchema, {
    name: 'avaliar_resposta',
  });

  const messages = [
    { role: 'system', content: 'Você é um professor.' },
    { role: 'user', content: userContent },
  ];

  return comRetry(() => llmAvalia.invoke(messages as any));
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

  const resposta = await comRetry(() => llm.invoke(messages));
  return typeof resposta.content === 'string' ? resposta.content : String(resposta.content);
}
