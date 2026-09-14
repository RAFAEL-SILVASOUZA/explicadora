import { QuestaoLLM } from './types';
import { PROMPT_GERAR_QUESTOES, PROMPT_AVALIAR_RESPOSTA, PROMPT_VEREDITO } from './prompts';

export interface ImagemProcessada {
  base64: string;
  mime: string;
}

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

// Tenta extrair um array JSON mesmo se a LLM envolver o JSON em texto extra.
function extrairArrayJSON<T>(text: string): T {
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
  const inicio = cleaned.indexOf('[');
  const fim = cleaned.lastIndexOf(']');
  if (inicio !== -1 && fim !== -1 && fim > inicio) {
    return JSON.parse(cleaned.slice(inicio, fim + 1)) as T;
  }
  return JSON.parse(cleaned) as T;
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

  const messages = [
    { role: 'system', content: PROMPT_GERAR_QUESTOES },
    { role: 'user', content: userContent },
  ];

  // 1 retry em caso de JSON inválido (comum quando há muitas imagens).
  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const response = await callLLM(messages);
    try {
      const questoes = extrairArrayJSON<QuestaoLLM[]>(response);
      if (Array.isArray(questoes) && questoes.length > 0) {
        // Garante que o campo 'dica' exista mesmo se a LLM omitir.
        return questoes.map((q) => ({ ...q, dica: q.dica || '' }));
      }
      ultimoErro = new Error('LLM retornou lista vazia');
    } catch (e) {
      ultimoErro = e;
    }
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

  const messages = [
    { role: 'system', content: 'Você é um professor. Responda apenas JSON válido.' },
    { role: 'user', content: userContent },
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
