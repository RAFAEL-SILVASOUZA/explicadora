import { Arquivo } from '../types';

// A API nunca devolve o caminho de disco nem o hash: são detalhes internos que não
// servem ao cliente e revelam a estrutura do servidor (mesma razão de senha_hash em
// Conta não sair pela API). O hash voltaria a permitir dedupe pelo navegador, mas o
// dedupe é decisão do servidor.
export interface ArquivoPublico {
  id: string;
  nome: string;
  mime: string;
  tamanho: number;
  origem: string;
  criado_em: string;
}

export function paraArquivoPublico(arquivo: Arquivo): ArquivoPublico {
  return {
    id: arquivo.id,
    nome: arquivo.nome,
    mime: arquivo.mime,
    tamanho: arquivo.tamanho,
    origem: arquivo.origem,
    criado_em: arquivo.criado_em,
  };
}
