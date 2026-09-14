// Limite de segurança: número máximo de imagens enviadas à LLM de uma vez.
// Acima disso, o contexto de visão estoura e a geração falha.
// Mantido em um arquivo sem dependências de servidor para poder ser
// importado tanto no servidor quanto no cliente.
export const MAX_IMAGENS = 40;
