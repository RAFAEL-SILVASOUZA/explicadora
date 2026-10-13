// A chave da tentativa de submissão identifica o envio do form. Ela sobrevive à
// saída: "sair" limpa o token, mas a tentativa continua para o lookup de retomada
// ao voltar. É separada do token porque o token é a credencial, a tentativa é o
// estado da submissão.
const CHAVE = 'estudo_tentativa';

export function guardarTentativa(chave: string): void {
  localStorage.setItem(CHAVE, chave);
}

// O componente chama este helper no pré-render, onde localStorage não existe:
// no servidor não há tentativa pendente, então devolve null em vez de lançar.
export function lerTentativa(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(CHAVE);
}

export function limparTentativa(): void {
  localStorage.removeItem(CHAVE);
}
