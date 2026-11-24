import { expect, test } from 'vitest';
import { calcularResumo, revisaoFinalizada } from '../../lib/resumo';
import type { ResumoDever, ResumoRevisao } from '../../lib/types';

// O FIXO da data de teste: o "esta semana" depende de `agora`, então a função recebe
// a data explícita — com um agora fixo, o teste não vira relógio do último domingo.
const AGORA = new Date('2026-11-24T12:00:00Z');
const DIAS_ATRAS = (dias: number) => new Date(AGORA.getTime() - dias * 24 * 60 * 60 * 1000).toISOString();

function revisao(parcial: Partial<ResumoRevisao>): ResumoRevisao {
  return {
    id: 'rev-1', conta_id: 'conta-1', titulo: null, conteudo_texto: 'texto', criado_em: AGORA.toISOString(),
    total_questoes: 0, total_respostas: 0, acertos: 0, ...parcial,
  };
}

function dever(parcial: Partial<ResumoDever>): ResumoDever {
  return {
    id: 'dev-1', conta_id: 'conta-1', titulo: null, disciplina: null, serie_ano: 'fundamental_i_ii',
    nivel: 'crianca', conteudo_texto: 'texto', resumo_para_pais: null, arquivo_ids: [],
    lido_ate: 0, concluido: false, criado_em: AGORA.toISOString(), total_slides: 5, ...parcial,
  };
}

test('revisaoFinalizada exige pergunta e todas respondidas', () => {
  expect(revisaoFinalizada({ total_questoes: 5, total_respostas: 5 })).toBe(true);
  expect(revisaoFinalizada({ total_questoes: 5, total_respostas: 3 })).toBe(false);
  expect(revisaoFinalizada({ total_questoes: 0, total_respostas: 0 })).toBe(false);
  // Mais respostas que perguntas (invariante que o SQL pode infringir) não inventa finalizada.
  expect(revisaoFinalizada({ total_questoes: 5, total_respostas: 7 })).toBe(true);
});

test('sem revisões e sem deveres: zeros e percentuais nulos (nada é "0%")', () => {
  const r = calcularResumo([], [], AGORA);

  expect(r.revisoes).toBe(0);
  expect(r.revisoesFinalizadas).toBe(0);
  expect(r.revisoesEstaSemana).toBe(0);
  expect(r.totalQuestoes).toBe(0);
  expect(r.totalRespostas).toBe(0);
  expect(r.acertos).toBe(0);
  expect(r.percentualAcertos).toBeNull();
  expect(r.deveres).toBe(0);
  expect(r.deveresConcluidos).toBe(0);
  expect(r.deveresEstaSemana).toBe(0);
  expect(r.slidesLidos).toBe(0);
  expect(r.slidesTotal).toBe(0);
  expect(r.percentualLeitura).toBeNull();
});

test('totais: questões, respostas e acertos somam todas as revisões', () => {
  const revisoes = [
    revisao({ id: 'a', total_questoes: 5, total_respostas: 5, acertos: 4 }),
    revisao({ id: 'b', total_questoes: 4, total_respostas: 2, acertos: 1 }),
  ];

  const r = calcularResumo(revisoes, [], AGORA);

  expect(r.revisoes).toBe(2);
  expect(r.totalQuestoes).toBe(9);
  expect(r.totalRespostas).toBe(7);
  expect(r.acertos).toBe(5);
  // Percentual sobre TODAS as perguntas (mesma regra da página de resultado).
  expect(r.percentualAcertos).toBe(56); // 5/9 → 55.5 → 56
});

test('finalizadas contam só revisões onde toda pergunta foi respondida', () => {
  const revisoes = [
    revisao({ id: 'a', total_questoes: 5, total_respostas: 5 }),
    revisao({ id: 'b', total_questoes: 5, total_respostas: 3 }),
    revisao({ id: 'c', total_questoes: 0, total_respostas: 0 }),
  ];

  expect(calcularResumo(revisoes, [], AGORA).revisoesFinalizadas).toBe(1);
});

test('esta semana conta apenas criadas nos últimos 7 dias, inclusive o limite', () => {
  const revisoes = [
    revisao({ id: 'a', criado_em: DIAS_ATRAS(0) }),
    revisao({ id: 'b', criado_em: DIAS_ATRAS(6.9) }),
    // Agora - 7 dias = exatamente 7 dias: estourar o limite não conta.
    revisao({ id: 'c', criado_em: DIAS_ATRAS(7.5) }),
    revisao({ id: 'd', criado_em: DIAS_ATRAS(30) }),
  ];

  expect(calcularResumo(revisoes, [], AGORA).revisoesEstaSemana).toBe(2);
});

test('deveres: totais, concluídos e leitura (clamp já garantido pelo repo)', () => {
  const deveres = [
    dever({ id: 'a', lido_ate: 4, concluido: true }),
    dever({ id: 'b', lido_ate: 3, concluido: false, total_slides: 6 }),
  ];

  const r = calcularResumo([], deveres, AGORA);

  expect(r.deveres).toBe(2);
  expect(r.deveresConcluidos).toBe(1);
  expect(r.slidesLidos).toBe(7);
  expect(r.slidesTotal).toBe(11);
  expect(r.percentualLeitura).toBe(64); // 7/11 = 63.6 → 64
});

test('deveres sem slides (total 0): percentual de leitura nulo, nunca 0%', () => {
  const deveres = [dever({ total_slides: 0, lido_ate: 0 })];

  const r = calcularResumo([], deveres, AGORA);

  expect(r.percentualLeitura).toBeNull();
});

test('deveres desta semana contam criados nos últimos 7 dias', () => {
  const deveres = [
    dever({ id: 'a', criado_em: DIAS_ATRAS(2) }),
    dever({ id: 'b', criado_em: DIAS_ATRAS(10) }),
  ];

  expect(calcularResumo([], deveres, AGORA).deveresEstaSemana).toBe(1);
});

test('lido_ate ausente (coluna não devolvida) não estoura e conta como 0', () => {
  const deveres = [dever({ lido_ate: undefined as unknown as number })];

  expect(calcularResumo([], deveres, AGORA).slidesLidos).toBe(0);
});
