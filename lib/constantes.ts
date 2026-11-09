// Limite de segurança: número máximo de imagens enviadas à LLM de uma vez.
// Acima disso, o contexto de visão estoura e a geração falha.
// Mantido em um arquivo sem dependências de servidor para poder ser
// importado tanto no servidor quanto no cliente.
export const MAX_IMAGENS = 40;

// Limite por arquivo da biblioteca (bytes). Protege a memória do processo: um upload
// é lido inteiro em Buffer antes de processar. Não é cota de espaço por conta
// (decisão da v1: sem cota), é o teto de um envio só.
export const MAX_BYTES_POR_ARQUIVO = 10 * 1024 * 1024;

// Máximo de arquivos num único envio da biblioteca, pelo mesmo motivo do limite de
// imagens: N Buffers simultâneos no processo.
export const MAX_ARQUIVOS_POR_ENVIO = 40;

// Máximo de caracteres do nome editável na biblioteca (renomeio). Vale para o
// radical; a extensão (png, pdf...) fica fora porque o aluno não a edita.
// É regra de API, não CHECK no banco: arquivos enviados antes desta regra podem
// ter nome maior, e um CHECK quebraria os dados existentes.
export const MAX_CARACTERES_NOME_ARQUIVO = 25;
