export type Role = 'user' | 'admin';

export interface Conta {
  id: string;
  email: string;
  role: Role;
  saldo_revisoes: number;
  criado_em: string;
  senha_hash?: string; // presente apenas na leitura interna, nunca devolvido pela API
}

export interface Plano {
  codigo: string;
  nome: string;
  revisoes: number;
  preco_cents: number;
}

export interface QuestaoLLM {
  tipo: 'multipla_escolha' | 'resposta_digitada';
  enunciado: string;
  opcoes: string[];
  resposta_correta: string;
  dica: string;
}

export interface Questao {
  id: number;
  revisao_id: string;
  tipo: string;
  enunciado: string;
  opcoes: string[];
  resposta_correta: string;
  dica: string;
  ordem: number;
}

export interface Resposta {
  id: number;
  questao_id: number;
  resposta_dada: string;
  correto: boolean;
  explicacao: string;
  respondida_em: string;
}

export interface Revisao {
  id: string;
  conta_id: string;
  titulo: string | null;
  conteudo_texto: string;
  criado_em: string;
  veredito?: string | null;
}

export interface RevisaoCompleta {
  revisao: Revisao;
  questoes: Questao[];
  respostas: Resposta[];
}

// A linha da grid da área de revisões: a revisão mais o resumo do andamento.
export interface ResumoRevisao extends Revisao {
  total_questoes: number;
  total_respostas: number;
  acertos: number;
}

export interface ResultadoRevisao {
  acertos: number;
  total: number;
  percentual: number;
  veredito: string | null;
}

export interface QuestaoInput {
  tipo: string;
  enunciado: string;
  opcoes: string[];
  resposta_correta: string;
  dica: string;
}
