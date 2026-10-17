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
