import { describe, it, expect, vi, afterEach } from 'vitest';
import { embaralharOpcoes, avaliarResposta, gerarQuestoes, gerarVeredito } from './llm';
import { QuestaoLLM } from './types';

// Integração real: o teste chama a API de LLM local (endpoint OpenAI-compatível)
// configurada em lib/llm.ts. O timeout é generoso porque o modelo local é lento.
const TIMEOUT_INTEGRACAO = 180_000;

function questaoMultipla(opcoes: string[], resposta_correta: string): QuestaoLLM {
  return { tipo: 'multipla_escolha', enunciado: 'Enunciado', opcoes, resposta_correta, dica: '' };
}

function questaoDigitada(): QuestaoLLM {
  return { tipo: 'resposta_digitada', enunciado: 'Enunciado', opcoes: [], resposta_correta: '42', dica: '' };
}

describe('embaralharOpcoes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mantém o mesmo conjunto de opções, só muda a ordem', () => {
    const original = questaoMultipla(['A', 'B', 'C', 'D'], 'A');
    const [resultado] = embaralharOpcoes([original]);
    expect(resultado.opcoes.slice().sort()).toEqual(original.opcoes.slice().sort());
  });

  it('preserva a resposta_correta e ela continua presente nas opções', () => {
    const original = questaoMultipla(['A', 'B', 'C', 'D'], 'C');
    const [resultado] = embaralharOpcoes([original]);
    expect(resultado.resposta_correta).toBe('C');
    expect(resultado.opcoes).toContain('C');
  });

  it('não mexe em questões de resposta digitada (opcoes vazio)', () => {
    const original = questaoDigitada();
    const [resultado] = embaralharOpcoes([original]);
    expect(resultado.opcoes).toEqual([]);
    expect(resultado.resposta_correta).toBe('42');
  });

  it('efetivamente muda a posição quando o sorteio não é identidade', () => {
    // Força Math.random a produzir uma permutação diferente da original.
    const valores = [0.9, 0.1, 0.1];
    let i = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => valores[i++ % valores.length]);

    const original = questaoMultipla(['A', 'B', 'C', 'D'], 'A');
    const [resultado] = embaralharOpcoes([original]);

    expect(resultado.opcoes).not.toEqual(original.opcoes);
    expect(resultado.opcoes.slice().sort()).toEqual(original.opcoes.slice().sort());
  });

  it('não muta o array de opções original', () => {
    const original = questaoMultipla(['A', 'B', 'C', 'D'], 'A');
    const opcoesAntes = [...original.opcoes];
    embaralharOpcoes([original]);
    expect(original.opcoes).toEqual(opcoesAntes);
  });
});

describe('integração com a API real de LLM', () => {
  it('avaliarResposta: resposta correta vem marcada como correta, com explicação', async () => {
    const questao = {
      tipo: 'multipla_escolha' as const,
      enunciado: 'Quanto é 2 + 2?',
      opcoes: ['3', '4', '5', '6'],
      resposta_correta: '4',
      dica: 'Some os dois números.',
    };

    const resultado = await avaliarResposta(questao, '4');

    expect(resultado.correto).toBe(true);
    expect(typeof resultado.explicacao).toBe('string');
    expect(resultado.explicacao.length).toBeGreaterThan(0);
  }, TIMEOUT_INTEGRACAO);

  it('avaliarResposta: resposta errada vem marcada como errada, com explicação', async () => {
    const questao = {
      tipo: 'multipla_escolha' as const,
      enunciado: 'Quanto é 2 + 2?',
      opcoes: ['3', '4', '5', '6'],
      resposta_correta: '4',
      dica: 'Some os dois números.',
    };

    const resultado = await avaliarResposta(questao, '7');

    expect(resultado.correto).toBe(false);
    expect(typeof resultado.explicacao).toBe('string');
    expect(resultado.explicacao.length).toBeGreaterThan(0);
  }, TIMEOUT_INTEGRACAO);

  it('gerarQuestoes: devolve 5 a 10 questões válidas na estrutura esperada', async () => {
    const conteudo = `Capitais de países:
- França: Paris
- Itália: Roma
- Espanha: Madri
- Alemanha: Berlim
- Portugal: Lisboa
- Argentina: Buenos Aires
- Japão: Tóquio
- Austrália: Camberra`;

    const questoes = await gerarQuestoes(conteudo, []);

    expect(Array.isArray(questoes)).toBe(true);
    expect(questoes.length).toBeGreaterThanOrEqual(5);
    expect(questoes.length).toBeLessThanOrEqual(10);

    for (const q of questoes) {
      expect(['multipla_escolha', 'resposta_digitada']).toContain(q.tipo);
      expect(q.enunciado.length).toBeGreaterThan(0);
      expect(typeof q.resposta_correta).toBe('string');
      expect(q.resposta_correta.length).toBeGreaterThan(0);
      expect(typeof q.dica).toBe('string');
      if (q.tipo === 'multipla_escolha') {
        expect(q.opcoes.length).toBeGreaterThanOrEqual(2);
        expect(q.opcoes).toContain(q.resposta_correta);
      } else {
        expect(q.opcoes).toEqual([]);
      }
    }
  }, TIMEOUT_INTEGRACAO);

  it('gerarVeredito: devolve um texto amigável em string', async () => {
    const veredito = await gerarVeredito(4, 5, [
      { tipo: 'multipla_escolha', enunciado: 'Quanto é 7 x 8?', opcoes: ['52', '56', '63', '64'], resposta_correta: '56', dica: 'Pense em 7 x 10 menos 7 x 2.' },
    ]);

    expect(typeof veredito).toBe('string');
    expect(veredito.length).toBeGreaterThan(20);
  }, TIMEOUT_INTEGRACAO);
});
