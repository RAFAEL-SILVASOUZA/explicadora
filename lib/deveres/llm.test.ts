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

type Primitivos = Storyboard['passos'][number]['cena']['primitivos'];

// Cena com primitivos escritos como o modelo os escreve (campos com default
// omitidos); o cast só silencia os defaults do schema de saída.
function cenaCom(primitivos: unknown[]): Storyboard {
  const sb = storyboardValido(1);
  sb.passos[0].cena.primitivos = primitivos as Primitivos;
  return sb;
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

  it('após esgotar as tentativas neutraliza o passo: frase neutra e cena sem o que revela', async () => {
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
    // A forma muda sobrevive à degradação: o desenho continua ensinando.
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

  // Finding da revisão (spec §4.2): a auditoria precisa ver o storyboard inteiro,
  // incluindo o que a cena desenha. Um texto '42' na cena entrega o resultado à
  // criança mesmo com narração inocente.
  it('a auditoria recebe as strings desenháveis da cena', async () => {
    const sb = cenaCom([
      { kind: 'texto', x: 0.1, y: 0.2, valor: '42', tamanho: 0.1 },
      { kind: 'emoji', x: 0.5, y: 0.2, valor: '🎉', tamanho: 0.1 },
      { kind: 'reta_numerica', x: 0.1, y: 0.5, w: 0.8, minimo: 0, maximo: 10, marcas: [3, 4], rotulo: '3 + 4 = 7' },
      { kind: 'barra_modelo', x: 0.1, y: 0.7, w: 0.8, h: 0.2, partes: [{ valor: 3, rotulo: 'três mais quatro igual a sete' }] },
      { kind: 'balanca', x: 0.1, y: 0.9, w: 0.8, prato_esquerdo: ['3 + 4'], prato_direito: ['7'] },
    ]);
    invokeStructured
      .mockResolvedValueOnce(sb)
      .mockResolvedValue({ vaza_resposta: false, passo: 0, motivo: '' });

    await gerarStoryboardSeguro('dever', []);
    const input = inputDaAuditoria();
    expect(input).toContain('42');
    expect(input).toContain('🎉');
    expect(input).toContain('3 + 4 = 7');
    expect(input).toContain('três mais quatro igual a sete');
    expect(input).toContain('3 + 4');
    expect(input).toContain('Vamos entender o que a questão pede.');
  });

  // Finding P77 da revisão broad: o renderizador imprime números (desenho.ts:79
  // desenha String(marca); 82-88 marca um ponto numerado). Uma reta com marcas
  // [42] e destaque 42 mostra o 42 na tela mesmo com narração inocente.
  it('a auditoria recebe os números desenháveis da cena', async () => {
    const sb = cenaCom([
      { kind: 'reta_numerica', x: 0.1, y: 0.5, w: 0.8, minimo: 0, maximo: 50, marcas: [42], destaque: 42, rotulo: 'reta' },
      { kind: 'blocos', x: 0.1, y: 0.7, w: 0.4, colunas: 2, itens: 42 },
      { kind: 'barra_modelo', x: 0.1, y: 0.9, w: 0.8, h: 0.2, partes: [{ valor: 42, rotulo: 'parte' }] },
    ]);
    invokeStructured
      .mockResolvedValueOnce(sb)
      .mockResolvedValue({ vaza_resposta: false, passo: 0, motivo: '' });

    await gerarStoryboardSeguro('dever', []);
    const input = inputDaAuditoria();
    expect(input).toContain('marcas: 42');
    expect(input).toContain('destaque: 42');
    expect(input).toContain('itens: 42');
    // O valor da parte da barra define a largura proporcional desenhada.
    expect(input).toContain('42');
  });

  // Finding P79 da revisão broad: o título do storyboard vira o <h1> da tela da
  // criança. Um 'A resposta é 42' entrega o resultado sem passar por nenhum passo.
  it('a auditoria recebe o título do storyboard', async () => {
    const sb = storyboardValido(1);
    sb.titulo = 'A resposta é 42';
    invokeStructured
      .mockResolvedValueOnce(sb)
      .mockResolvedValue({ vaza_resposta: false, passo: 0, motivo: '' });

    await gerarStoryboardSeguro('dever', []);
    const input = inputDaAuditoria();
    expect(input).toContain('Título: A resposta é 42');
    // O título auditado vem antes dos passos.
    expect(input.indexOf('Título:')).toBeLessThan(input.indexOf('1. Passo 1'));
  });

  // Finding P78 da revisão broad: trocar só a narração manteria visível o
  // vazamento que a auditoria apontou na cena. A degradação limpa a cena do passo.
  it('a degradação remove da cena os primitivos que revelam o resultado', async () => {
    // O passo regenerado continua vazando na cena: é ele que a degradação neutraliza.
    const passoVazando = {
      titulo: 'Passo 1', narracao: 'Continua vazando.',
      cena: {
        fundo: '#FDF6EC',
        primitivos: [
          { kind: 'texto', x: 0.1, y: 0.2, valor: '42', tamanho: 0.1 },
          { kind: 'emoji', x: 0.3, y: 0.2, valor: '🎉', tamanho: 0.1 },
          { kind: 'reta_numerica', x: 0.1, y: 0.5, w: 0.8, minimo: 0, maximo: 50, marcas: [42], destaque: 42, rotulo: 'reta' },
          { kind: 'blocos', x: 0.1, y: 0.7, w: 0.4, colunas: 2, itens: 42 },
          { kind: 'barra_modelo', x: 0.1, y: 0.9, w: 0.8, h: 0.2, partes: [{ valor: 42, rotulo: 'quarenta e dois' }] },
          { kind: 'circulo', x: 0.8, y: 0.5, r: 0.1, cor: '#7C5CFC' },
        ],
      },
    };
    invokeStructured
      .mockResolvedValueOnce(storyboardValido(1))                                 // gerar
      .mockResolvedValueOnce({ vaza_resposta: true, passo: 1, motivo: 'a' })      // auditoria 1
      .mockResolvedValueOnce(passoVazando)                                        // regenerar 1
      .mockResolvedValueOnce({ vaza_resposta: true, passo: 1, motivo: 'b' })      // auditoria 2
      .mockResolvedValueOnce(passoVazando)                                        // regenerar 2
      .mockResolvedValue({ vaza_resposta: true, passo: 1, motivo: 'c' });         // auditoria 3

    const r = await gerarStoryboardSeguro('dever', []);
    expect(r.vazamentoNaoCorrigido).toBe(true);
    expect(r.storyboard.passos[0].narracao).toBe(FRASE_NEUTRA);

    const kinds = r.storyboard.passos[0].cena.primitivos.map((p) => p.kind);
    // texto e emoji carregam a string reveladora: descartados.
    expect(kinds).not.toContain('texto');
    expect(kinds).not.toContain('emoji');
    // A forma muda sobrevive: o desenho continua ensinando.
    expect(kinds).toContain('circulo');

    const reta = r.storyboard.passos[0].cena.primitivos
      .find((p) => p.kind === 'reta_numerica') as Extract<Primitivos[number], { kind: 'reta_numerica' }>;
    expect(reta.marcas).toEqual([]);
    expect(reta.destaque).toBeUndefined();

    const blocos = r.storyboard.passos[0].cena.primitivos
      .find((p) => p.kind === 'blocos') as Extract<Primitivos[number], { kind: 'blocos' }>;
    expect(blocos.itens).toBe(1);

    const barra = r.storyboard.passos[0].cena.primitivos
      .find((p) => p.kind === 'barra_modelo') as Extract<Primitivos[number], { kind: 'barra_modelo' }>;
    expect(barra.partes.map((parte) => parte.valor)).toEqual([0]);

    // Nenhum 42 sobrevive na cena neutralizada.
    expect(JSON.stringify(r.storyboard.passos[0].cena)).not.toContain('42');
  });

  // Finding da revisão: `auditoria.passo` vem do LLM. Fora de [1, passos.length]
  // (99, 0, NaN) a regeneração criaria buracos undefined no array.
  it('índice de vazamento fora da faixa é tratado como não vazar', async () => {
    invokeStructured
      .mockResolvedValueOnce(storyboardValido(3))
      .mockResolvedValue({ vaza_resposta: true, passo: 99, motivo: 'fora da faixa' });

    const r = await gerarStoryboardSeguro('dever', []);
    expect(r.vazamentoNaoCorrigido).toBe(false);
    expect(r.storyboard.passos).toHaveLength(3);
    expect(r.storyboard.passos.every((p) => p.narracao !== FRASE_NEUTRA)).toBe(true);
    // Só gerar + auditar: nenhuma regeneração foi tentada.
    expect(invokeStructured).toHaveBeenCalledTimes(2);
  });

  it('índice NaN é tratado como não vazar', async () => {
    invokeStructured
      .mockResolvedValueOnce(storyboardValido(3))
      .mockResolvedValue({ vaza_resposta: true, passo: Number.NaN, motivo: 'sem índice' });

    const r = await gerarStoryboardSeguro('dever', []);
    expect(r.vazamentoNaoCorrigido).toBe(false);
    expect(r.storyboard.passos).toHaveLength(3);
    expect(invokeStructured).toHaveBeenCalledTimes(2);
  });

  // Gap de spec §9: storyboard inválido em todas as tentativas esgota o retry e
  // lança (a mensagem é tratada na rota).
  it('storyboard sem passos esgota as tentativas e lança', async () => {
    invokeStructured.mockResolvedValue({
      titulo: 'Vazio', disciplina: 'Matemática', resumo_para_pais: '', passos: [],
    });
    await expect(gerarStoryboardSeguro('dever', [])).rejects.toThrow();
    expect(invokeStructured).toHaveBeenCalledTimes(3);
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
