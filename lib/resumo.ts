import type { ResumoDever, ResumoRevisao } from './types';

// O placar da home (quantos estudos, quantos acertos, quanto lido) mora em UM lugar:
// esta função. Toda métrica da tela devolve o mesmo número daqui, sempre — a tela que
// apresenta um número como fato precisa da fonte definida (ver LESSONS.md).
// Quanto mais simples a regra, menos a matemática muda de lugar entre telas.

// Uma revisão está finalizada quando toda pergunta foi respondida. Uma revisão vazia
// não é finalizada: zero questões não é prova de que o aluno passou por todas.
export function revisaoFinalizada(r: { total_questoes: number; total_respostas: number }): boolean {
  return r.total_questoes > 0 && r.total_respostas >= r.total_questoes;
}

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export interface ResumoHome {
  revisoes: number;
  revisoesFinalizadas: number;
  revisoesEstaSemana: number;
  totalQuestoes: number;
  totalRespostas: number;
  acertos: number;
  // Mesma regra da página de resultado: acertos sobre TODAS as perguntas da revisão
  // (não sobre as respondidas). null quando não há perguntas ainda: "0%" sem
  // perguntas não comunicaria nada, e a tela não mostra números sem fonte.
  percentualAcertos: number | null;
  deveres: number;
  deveresConcluidos: number;
  deveresEstaSemana: number;
  slidesLidos: number;
  slidesTotal: number;
  percentualLeitura: number | null;
}

// É assim mesmo que a tela mostra: os contadores vêm uma única vez e não se recalculam
// por cartão, para a página não mostrar "3 revisões" no cartão A e "4" no cartão B.
export function calcularResumo(
  revisoes: ResumoRevisao[], deveres: ResumoDever[], agora: Date = new Date(),
): ResumoHome {
  const limite = agora.getTime() - SETE_DIAS_MS;
  const estaSemana = (iso: string) => new Date(iso).getTime() >= limite;

  const revisoesFinalizadas = revisoes.filter(revisaoFinalizada).length;
  const totalQuestoes = revisoes.reduce((soma, r) => soma + r.total_questoes, 0);
  const totalRespostas = revisoes.reduce((soma, r) => soma + r.total_respostas, 0);
  const acertos = revisoes.reduce((soma, r) => soma + r.acertos, 0);

  // lido_ate vem do repo já limitado ao número de slides (LEAST); o `?? 0` cobre o
  // caso em que o banco não devolve a coluna (ex.: linha antiga ou teste parcial).
  const slidesLidos = deveres.reduce((soma, d) => soma + (d.lido_ate ?? 0), 0);
  const slidesTotal = deveres.reduce((soma, d) => soma + d.total_slides, 0);

  return {
    revisoes: revisoes.length,
    revisoesFinalizadas,
    revisoesEstaSemana: revisoes.filter((r) => estaSemana(r.criado_em)).length,
    totalQuestoes,
    totalRespostas,
    acertos,
    percentualAcertos: totalQuestoes > 0 ? Math.round((acertos / totalQuestoes) * 100) : null,
    deveres: deveres.length,
    deveresConcluidos: deveres.filter((d) => d.concluido).length,
    deveresEstaSemana: deveres.filter((d) => estaSemana(d.criado_em)).length,
    slidesLidos,
    slidesTotal,
    percentualLeitura: slidesTotal > 0 ? Math.round((slidesLidos / slidesTotal) * 100) : null,
  };
}
