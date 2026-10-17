import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { ImagemProcessada } from '../llm';
import {
  PassoSchema, StoryboardSchema, Storyboard, sanitizarStoryboard, type Cena, type Passo, type Primitivo,
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

// O que o renderizador desenha na tela da criança: strings E números. Um
// `texto.valor` = '42' ou um rótulo com a conta resolvida entrega o resultado
// mesmo com narração inocente, então a auditoria (spec §4.2: ver o storyboard
// inteiro) precisa ler a cena também. Os campos numéricos desenháveis entram
// como texto porque o canvas os imprime: `reta_numerica.marcas` vira
// `String(marca)` e `destaque` um ponto numerado (desenho.ts:79, 82-88),
// `blocos.itens` é uma contagem visível de objetos (desenho.ts:151-156) e
// `barra_modelo.partes[].valor` define larguras proporcionais (desenho.ts:100-103).
// Defensivo de propósito: um primitivo malformado vindo do modelo não pode
// derrubar a auditoria, só é ignorado.
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
        // Além do rótulo, as marcas e o destaque são números impressos na tela.
        if (typeof pr.rotulo === 'string') saida.push(pr.rotulo);
        if (Array.isArray(pr.marcas)) {
          const marcas = pr.marcas.filter((m) => typeof m === 'number' && Number.isFinite(m));
          if (marcas.length > 0) saida.push(`marcas: ${marcas.join(' ')}`);
        }
        if (typeof pr.destaque === 'number' && Number.isFinite(pr.destaque)) {
          saida.push(`destaque: ${pr.destaque}`);
        }
        break;
      case 'barra_modelo':
        if (Array.isArray(pr.partes)) {
          for (const parte of pr.partes) {
            const pt = parte as { rotulo?: unknown; valor?: unknown } | null;
            if (typeof pt?.rotulo === 'string') saida.push(pt.rotulo);
            if (typeof pt?.valor === 'number' && Number.isFinite(pt.valor)) saida.push(String(pt.valor));
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
      case 'blocos':
        // A contagem de objetos é o que a criança vê: itens: 7 mostra sete formas.
        if (typeof pr.itens === 'number' && Number.isFinite(pr.itens)) {
          saida.push(`itens: ${pr.itens}`);
        }
        break;
    }
  }
  return saida.filter((s) => s.trim() !== '');
}

export async function revisarVazamento(storyboard: Storyboard): Promise<VazamentoResultado> {
  const alvo = llm.withStructuredOutput(VazamentoSchema, { name: 'auditar_vazamento' });
  // O título do storyboard vira o <h1> da tela da criança: um 'A resposta é 42'
  // entrega o resultado sem passar por nenhum passo, então entra no topo da auditoria.
  const explicacao = [
    `Título: ${storyboard.titulo}`,
    ...storyboard.passos.map(
      (p, i) => `${i + 1}. ${p.titulo}: ${p.narracao} | tela: ${stringsDaCena(p.cena).join(' ')}`,
    ),
  ].join('\n');
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

// Um primitivo da cena reescrito para a degradação, ou null para descartá-lo.
// Só mexe no que o renderizador imprime (stringsDaCena); formas geométricas
// mudas continuam ensinando.
function neutralizarPrimitivo(p: Record<string, unknown>): Record<string, unknown> | null {
  switch (p.kind) {
    case 'texto':
    case 'emoji':
      // Carregam a string reveladora direto na tela.
      return null;
    case 'reta_numerica': {
      // Finding P91: o rotulo da reta é impresso (stringsDaCena o coleta), então
      // zerar só marcas/destaque deixaria 'quarenta e dois' na tela.
      const saida: Record<string, unknown> = { ...p, marcas: [] as number[], rotulo: '' };
      delete saida.destaque;
      return saida;
    }
    case 'blocos':
      // A contagem visível vira o mínimo do schema (1), não o número da resposta.
      return { ...p, itens: 1 };
    case 'barra_modelo': {
      // Finding P91: desenho.ts:105-110 desenha parte.rotulo dentro da barra. Um
      // rotulo com a resposta por extenso sobreviveria a zerar só os valores.
      const saida: Record<string, unknown> = { ...p, rotulo: '' };
      if (!Array.isArray(p.partes)) return saida;
      saida.partes = p.partes.map((parte) => (
        parte && typeof parte === 'object'
          ? { ...(parte as Record<string, unknown>), valor: 0, rotulo: '' }
          : parte
      ));
      return saida;
    }
    default:
      return p;
  }
}

// Degradação final: além da fala fixa, limpa a cena do passo. Trocar só a
// narração deixaria visível o vazamento que a auditoria acabou de apontar na
// tela (texto '42', marca 42 na reta, sete blocos). Defensivo: a cena veio do
// modelo; um primitivo malformado é preservado como está, nunca derruba a
// degradação que devolve o dever pago pelo pai.
export function neutralizarPasso(sb: Storyboard, ordem: number): Storyboard {
  if (ordem < 1 || ordem > sb.passos.length) return sb;
  const passos = sb.passos.slice();
  const passo = passos[ordem - 1];
  const primitivos: Primitivo[] = [];
  for (const p of passo?.cena?.primitivos ?? []) {
    try {
      const neutro = neutralizarPrimitivo(p as unknown as Record<string, unknown>);
      if (neutro) primitivos.push(neutro as unknown as Primitivo);
    } catch {
      primitivos.push(p);
    }
  }
  passos[ordem - 1] = {
    ...passo,
    narracao: FRASE_NEUTRA,
    cena: { ...(passo?.cena ?? {}), primitivos } as Cena,
  };
  return { ...sb, passos };
}

// Duas camadas (spec §4.2): o prompt pede, a auditoria verifica. O laço alterna
// auditoria e regeneração até MAX_TENTATIVAS_VAZAMENTO regenerações. Se ainda
// vazar, degrada: neutraliza o passo (fala fixa + cena sem o que revela), em vez
// de descartar o dever que o pai pagou para criar.
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
    if (!auditoria.vaza_resposta) {
      return { storyboard: sanitizarStoryboard(storyboard), vazamentoNaoCorrigido: false };
    }
    if (!indiceValido) {
      // Vazamento reportado mas sem índice usável: não há como regenerar nem
      // neutralizar um passo. Logar para o ramo não passar silencioso como
      // "não vaza" no log do servidor.
      console.warn(
        `[deveres] vazamento reportado com índice inválido (${auditoria.passo}) não regenerado: ${auditoria.motivo}`,
      );
      return { storyboard: sanitizarStoryboard(storyboard), vazamentoNaoCorrigido: false };
    }

    if (tentativa === MAX_TENTATIVAS_VAZAMENTO) {
      console.warn(`[deveres] vazamento não corrigido no passo ${auditoria.passo}: ${auditoria.motivo}`);
      return {
        storyboard: sanitizarStoryboard(neutralizarPasso(storyboard, auditoria.passo)),
        vazamentoNaoCorrigido: true,
      };
    }

    storyboard = await regenerarPasso(storyboard, auditoria.passo, conteudoTexto, imagens, auditoria.motivo);
  }

  // Inalcançável: o laço sempre retorna dentro do limite.
  return { storyboard: sanitizarStoryboard(storyboard), vazamentoNaoCorrigido: false };
}
