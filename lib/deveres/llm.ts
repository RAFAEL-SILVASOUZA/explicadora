import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { ImagemProcessada } from '../llm';
import {
  PassoSchema, StoryboardSchema, Storyboard, sanitizarStoryboard, type Passo,
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

  const novo = await comRetry(() => alvo.invoke(messages as any)) as Passo;
  const passos = sb.passos.slice();
  // A auditoria numera a partir de 1; o array é 0-based.
  passos[ordem - 1] = novo;
  return { ...sb, passos };
}

// Strings que o renderizador desenha na tela da criança. Um `texto.valor` = '42'
// ou um rótulo com a conta resolvida entrega o resultado mesmo com narração
// inocente, então a auditoria (spec §4.2: ver o storyboard inteiro) precisa ler a
// cena também. Defensivo de propósito: um primitivo malformado vindo do modelo
// não pode derrubar a auditoria, só é ignorado.
function stringsDaCena(cena: unknown): string[] {
  const saida: string[] = [];
  const primitivos = (cena as { primitivos?: unknown } | null)?.primitivos;
  if (!Array.isArray(primitivos)) return saida;
  for (const p of primitivos) {
    if (!p || typeof p !== 'object') continue;
    const pr = p as Record<string, unknown>;
    switch (pr.kind) {
      case 'texto':
      case 'emoji':
        if (typeof pr.valor === 'string') saida.push(pr.valor);
        break;
      case 'reta_numerica':
        // No schema as marcas são números; a única string é o rótulo da reta.
        if (typeof pr.rotulo === 'string') saida.push(pr.rotulo);
        break;
      case 'barra_modelo':
        if (Array.isArray(pr.partes)) {
          for (const parte of pr.partes) {
            const rotulo = (parte as { rotulo?: unknown } | null)?.rotulo;
            if (typeof rotulo === 'string') saida.push(rotulo);
          }
        }
        break;
      case 'balanca':
        for (const chave of ['prato_esquerdo', 'prato_direito'] as const) {
          const prato = pr[chave];
          if (Array.isArray(prato)) {
            for (const item of prato) {
              if (typeof item === 'string') saida.push(item);
            }
          }
        }
        break;
    }
  }
  return saida.filter((s) => s.trim() !== '');
}

export async function revisarVazamento(storyboard: Storyboard): Promise<VazamentoResultado> {
  const alvo = llm.withStructuredOutput(VazamentoSchema, { name: 'auditar_vazamento' });
  const explicacao = storyboard.passos
    .map((p, i) => `${i + 1}. ${p.titulo}: ${p.narracao} | tela: ${stringsDaCena(p.cena).join(' ')}`)
    .join('\n');
  const messages = [
    { role: 'system', content: PROMPT_AUDITORIA },
    { role: 'user', content: explicacao },
  ];
  // O schema tem defaults para passo e motivo: em runtime os campos vêm sempre
  // preenchidos; o cast só alinha o tipo de saída do withStructuredOutput.
  return await comRetry(() => alvo.invoke(messages as any)) as VazamentoResultado;
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
    // O índice vem do LLM: fora de [1, passos.length] (99, 0, NaN) a regeneração
    // escreveria passos[ordem-1] fora do fim do array, criando buracos undefined
    // que fazem sanitizarStoryboard lançar TypeError (500 não-retryável). Fora da
    // faixa, tratamos como "não vaza" e seguimos adiante.
    const indiceValido = Number.isInteger(auditoria.passo)
      && auditoria.passo >= 1
      && auditoria.passo <= storyboard.passos.length;
    if (!auditoria.vaza_resposta || !indiceValido) {
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
