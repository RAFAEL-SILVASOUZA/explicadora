import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { ImagemProcessada } from '../llm';
import { PlanoSchema, Plano, Slide, SlideSchema, sanitizarPlano } from './slides';
import {
  PROMPT_AUDITORIA, PROMPT_CONTEXTO_DEVER, PROMPT_REGENERAR_SLIDE, PROMPT_PLANO,
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
  slide: z.number().int().default(0),
  motivo: z.string().default(''),
});

export interface VazamentoResultado {
  vaza_resposta: boolean;
  slide: number;
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

export async function gerarPlano(conteudoTexto: string, imagens: ImagemProcessada[]): Promise<Plano> {
  const alvo = llm.withStructuredOutput(PlanoSchema, { name: 'gerar_plano' });
  const messages = [
    { role: 'system', content: PROMPT_PLANO },
    { role: 'user', content: conteudoDoUsuario(conteudoTexto, imagens) },
  ];

  for (let tentativa = 0; tentativa < MAX_TENTATIVAS_LLM; tentativa++) {
    const plano = await comRetry(() => alvo.invoke(messages as any)) as Plano;
    if (Array.isArray(plano?.slides) && plano.slides.length > 0) return sanitizarPlano(plano);
  }
  throw new Error('A explicadora não devolveu nenhum slide.');
}

async function regenerarSlide(
  plano: Plano, ordem: number, conteudoTexto: string, imagens: ImagemProcessada[], motivo: string,
): Promise<Plano> {
  const alvo = llm.withStructuredOutput(SlideSchema, { name: 'regenerar_slide' });
  const prompt = PROMPT_REGENERAR_SLIDE
    .replace('{{MOTIVO}}', motivo || 'revela o resultado')
    .replace('{{ORDEM}}', String(ordem));

  const messages = [
    { role: 'system', content: PROMPT_PLANO },
    { role: 'user', content: [...conteudoDoUsuario(conteudoTexto, imagens), { type: 'text', text: prompt }] },
  ];

  const novo = await comRetry(() => alvo.invoke(messages as any)) as Slide;
  const slides = plano.slides.slice();
  // A auditoria numera a partir de 1; o array é 0-based.
  slides[ordem - 1] = novo;
  return { ...plano, slides };
}

export async function revisarVazamento(plano: Plano): Promise<VazamentoResultado> {
  const alvo = llm.withStructuredOutput(VazamentoSchema, { name: 'auditar_vazamento' });
  // O título do plano vira o <h1> da tela da criança: um 'A resposta é 42' entrega
  // o resultado sem passar por nenhum slide, então entra no topo da auditoria.
  const explicacao = [
    `Título: ${plano.titulo}`,
    ...plano.slides.map((s, i) => `${i + 1}. ${s.titulo}: ${s.explicacao}`),
  ].join('\n');
  const messages = [
    { role: 'system', content: PROMPT_AUDITORIA },
    { role: 'user', content: explicacao },
  ];
  // O schema tem defaults para slide e motivo: em runtime os campos vêm sempre
  // preenchidos; o cast só alinha o tipo de saída do withStructuredOutput.
  return await comRetry(() => alvo.invoke(messages as any)) as VazamentoResultado;
}

// Degradação final: além de regenerar não ter resolvido, trocar o texto do slide
// pela frase fixa. No modelo de slides a tela é o próprio texto, então limpar a
// explicação já limpa tudo o que a criança vê.
export function neutralizarSlide(plano: Plano, ordem: number): Plano {
  if (ordem < 1 || ordem > plano.slides.length) return plano;
  const slides = plano.slides.slice();
  slides[ordem - 1] = { ...slides[ordem - 1], explicacao: FRASE_NEUTRA };
  return { ...plano, slides };
}

// Duas camadas: o prompt pede, a auditoria verifica. O laço alterna auditoria e
// regeneração até MAX_TENTATIVAS_VAZAMENTO regenerações. Se ainda vazar, degrada:
// neutraliza o slide (texto fixo), em vez de descartar o dever que o pai pagou
// para criar.
export async function gerarPlanoSeguro(
  conteudoTexto: string, imagens: ImagemProcessada[],
): Promise<{ plano: Plano; vazamentoNaoCorrigido: boolean }> {
  let plano = await gerarPlano(conteudoTexto, imagens);

  for (let tentativa = 0; tentativa <= MAX_TENTATIVAS_VAZAMENTO; tentativa++) {
    const auditoria = await revisarVazamento(plano);
    // O índice vem do LLM: fora de [1, slides.length] (99, 0, NaN) a regeneração
    // escreveria slides[ordem-1] fora do fim do array, criando buracos undefined
    // que fazem sanitizarPlano lançar TypeError (500 não-retryável). Fora da
    // faixa, tratamos como "não vaza" e seguimos adiante.
    const indiceValido = Number.isInteger(auditoria.slide)
      && auditoria.slide >= 1
      && auditoria.slide <= plano.slides.length;
    if (!auditoria.vaza_resposta) {
      return { plano: sanitizarPlano(plano), vazamentoNaoCorrigido: false };
    }
    if (!indiceValido) {
      // Vazamento reportado mas sem índice usável: não há como regenerar nem
      // neutralizar um slide. Logar para o ramo não passar silencioso como
      // "não vaza" no log do servidor.
      console.warn(
        `[deveres] vazamento reportado com índice inválido (${auditoria.slide}) não regenerado: ${auditoria.motivo}`,
      );
      return { plano: sanitizarPlano(plano), vazamentoNaoCorrigido: false };
    }

    if (tentativa === MAX_TENTATIVAS_VAZAMENTO) {
      console.warn(`[deveres] vazamento não corrigido no slide ${auditoria.slide}: ${auditoria.motivo}`);
      return {
        plano: sanitizarPlano(neutralizarSlide(plano, auditoria.slide)),
        vazamentoNaoCorrigido: true,
      };
    }

    plano = await regenerarSlide(plano, auditoria.slide, conteudoTexto, imagens, auditoria.motivo);
  }

  // Inalcançável: o laço sempre retorna dentro do limite.
  return { plano: sanitizarPlano(plano), vazamentoNaoCorrigido: false };
}
