// Chave separada da de revisão: o usuário pode ter uma tentativa de revisão
// pendente e criar um dever na mesma sessão sem que uma sobrescreva a outra.
const CHAVE = 'estudo_tentativa_dever';

export function guardarTentativaDever(chave: string): void {
  localStorage.setItem(CHAVE, chave);
}

// Chamado no pré-render, onde localStorage não existe: sem sessão não há
// tentativa pendente, então devolve null em vez de lançar.
export function lerTentativaDever(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(CHAVE);
}

export function limparTentativaDever(): void {
  localStorage.removeItem(CHAVE);
}
