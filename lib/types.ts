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
  sessao_id: string;
  tipo: string;
  enunciado: string;
  opcoes_json: string;
  resposta_correta: string;
  dica: string;
  ordem: number;
}

export interface Resposta {
  id: number;
  questao_id: number;
  resposta_dada: string;
  correto: number;
  explicacao: string;
  respondida_em: string;
}

export interface Sessao {
  id: string;
  conteudo_texto: string;
  criada_em: string;
}

export interface SessaoCompleta {
  sessao: Sessao;
  questoes: Questao[];
  respostas: Resposta[];
}

export interface QuestaoInput {
  tipo: string;
  enunciado: string;
  opcoes: string[];
  resposta_correta: string;
  dica: string;
}
