// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FRASE_NEUTRA, gerarPlanoSeguro, neutralizarSlide } from './llm';
import type { Plano } from './slides';

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

function planoValido(slides = 3): Plano {
  return {
    titulo: 'Soma com barras',
    disciplina: 'Matemática',
    resumo_para_pais: 'A Lia explica o método das barras.',
    slides: Array.from({ length: slides }, (_, i) => ({
      titulo: `Slide ${i + 1}`,
      explicacao: 'Vamos entender o que a questão pede.',
    })),
  } as Plano;
}

// O input da auditoria é o content da 2ª chamada do mock (gerar, auditar, ...).
function inputDaAuditoria(chamada = 1): string {
  const messages = invokeStructured.mock.calls[chamada][0] as Array<{ content: unknown }>;
  return String(messages[1].content);
}

beforeEach(() => {
  invokeStructured.mockReset();
  invokePlain.mockReset();
});

// A mesma função mockada atende gerar, regenerar e auditar. As chamadas vêm em
// ordem fixa: gerar (1), auditar (2), regenerar (3), auditar (4), ... Cada teste
// enfileira as respostas nessa ordem com mockResolvedValueOnce; a última entra
// como mockResolvedValue para valer nas chamadas restantes.
describe('gerarPlanoSeguro', () => {
  it('sem vazamento devolve o plano intacto', async () => {
    invokeStructured
      .mockResolvedValueOnce(planoValido())
      .mockResolvedValue({ vaza_resposta: false, slide: 0, motivo: '' });
    const r = await gerarPlanoSeguro('dever', []);
    expect(r.plano.slides).toHaveLength(3);
    expect(r.vazamentoNaoCorrigido).toBe(false);
  });

  it('vazamento no slide 2 regenera só esse slide', async () => {
    const substituto = { titulo: 'Slide 2', explicacao: 'Agora separamos as partes.' };
    invokeStructured
      .mockResolvedValueOnce(planoValido())
      .mockResolvedValueOnce({ vaza_resposta: true, slide: 2, motivo: 'diz o resultado' })
      .mockResolvedValueOnce(substituto)
      .mockResolvedValue({ vaza_resposta: false, slide: 0, motivo: '' });

    const r = await gerarPlanoSeguro('dever', []);
    expect(r.vazamentoNaoCorrigido).toBe(false);
    expect(r.plano.slides[1].explicacao).toBe('Agora separamos as partes.');
    expect(r.plano.slides[0].explicacao).toBe('Vamos entender o que a questão pede.');
  });

  it('após esgotar as tentativas neutraliza o slide com a frase fixa', async () => {
    const substituto = { titulo: 'Slide 1', explicacao: 'Continua vazando.' };
    invokeStructured
      .mockResolvedValueOnce(planoValido())                                        // gerar
      .mockResolvedValueOnce({ vaza_resposta: true, slide: 1, motivo: 'a' })       // auditoria 1
      .mockResolvedValueOnce(substituto)                                           // regenerar 1
      .mockResolvedValueOnce({ vaza_resposta: true, slide: 1, motivo: 'b' })       // auditoria 2
      .mockResolvedValueOnce(substituto)                                           // regenerar 2
      .mockResolvedValue({ vaza_resposta: true, slide: 1, motivo: 'c' });          // auditoria 3

    const r = await gerarPlanoSeguro('dever', []);
    expect(r.vazamentoNaoCorrigido).toBe(true);
    expect(r.plano.slides[0].explicacao).toBe(FRASE_NEUTRA);
    expect(r.plano.slides[1].explicacao).not.toBe(FRASE_NEUTRA);
  });

  it('plano com slides demais é truncado para MAX_SLIDES', async () => {
    invokeStructured
      .mockResolvedValueOnce(planoValido(12))
      .mockResolvedValue({ vaza_resposta: false, slide: 0, motivo: '' });
    const r = await gerarPlanoSeguro('dever', []);
    expect(r.plano.slides).toHaveLength(8);
  });

  // O título do plano vira o <h1> da tela da criança. Um 'A resposta é 42'
  // entrega o resultado sem passar por nenhum slide, então entra no topo da auditoria.
  it('a auditoria recebe o título e a explicação de todos os slides', async () => {
    const plano = planoValido(2);
    plano.titulo = 'A resposta é 42';
    plano.slides[1].explicacao = 'Junte os três com os quatro.';
    invokeStructured
      .mockResolvedValueOnce(plano)
      .mockResolvedValue({ vaza_resposta: false, slide: 0, motivo: '' });

    await gerarPlanoSeguro('dever', []);
    const input = inputDaAuditoria();
    expect(input).toContain('Título: A resposta é 42');
    // O título auditado vem antes dos slides.
    expect(input.indexOf('Título:')).toBeLessThan(input.indexOf('1. Slide 1'));
    expect(input).toContain('2. Slide 2: Junte os três com os quatro.');
  });

  // `auditoria.slide` vem do LLM. Fora de [1, slides.length] (99, 0, NaN) a
  // regeneração criaria buracos undefined no array.
  it('índice de vazamento fora da faixa é tratado como não vazar', async () => {
    invokeStructured
      .mockResolvedValueOnce(planoValido(3))
      .mockResolvedValue({ vaza_resposta: true, slide: 99, motivo: 'fora da faixa' });

    const r = await gerarPlanoSeguro('dever', []);
    expect(r.vazamentoNaoCorrigido).toBe(false);
    expect(r.plano.slides).toHaveLength(3);
    expect(r.plano.slides.every((s) => s.explicacao !== FRASE_NEUTRA)).toBe(true);
    // Só gerar + auditar: nenhuma regeneração foi tentada.
    expect(invokeStructured).toHaveBeenCalledTimes(2);
  });

  it('índice NaN é tratado como não vazar', async () => {
    invokeStructured
      .mockResolvedValueOnce(planoValido(3))
      .mockResolvedValue({ vaza_resposta: true, slide: Number.NaN, motivo: 'sem índice' });

    const r = await gerarPlanoSeguro('dever', []);
    expect(r.vazamentoNaoCorrigido).toBe(false);
    expect(r.plano.slides).toHaveLength(3);
    expect(invokeStructured).toHaveBeenCalledTimes(2);
  });

  // Plano inválido em todas as tentativas esgota o retry e lança
  // (a mensagem é tratada na rota).
  it('plano sem slides esgota as tentativas e lança', async () => {
    invokeStructured.mockResolvedValue({
      titulo: 'Vazio', disciplina: 'Matemática', resumo_para_pais: '', slides: [],
    });
    await expect(gerarPlanoSeguro('dever', [])).rejects.toThrow();
    expect(invokeStructured).toHaveBeenCalledTimes(3);
  });
});

describe('neutralizarSlide', () => {
  it('substitui só o slide indicado', () => {
    const plano = planoValido(3);
    const r = neutralizarSlide(plano, 2);
    expect(r.slides[1].explicacao).toBe(FRASE_NEUTRA);
    expect(r.slides[0].explicacao).not.toBe(FRASE_NEUTRA);
  });

  it('slide fora do intervalo deixa o plano intacto', () => {
    const plano = planoValido(2);
    expect(neutralizarSlide(plano, 9).slides[0].explicacao).toBe(plano.slides[0].explicacao);
  });
});
