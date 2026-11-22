// O badge do header mostra o saldo. Quando uma página muda o saldo (resgate ou
// consumo), ela avisa o header por um evento no window: sem isso o header fica com
// o valor de quando montou. O helper não depende de React, então vale em qualquer
// página e é testável sem banco.
const EVENTO = 'saldo-atualizado';

export function notificarSaldo(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(EVENTO));
}

export function assinarSaldo(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENTO, callback);
  return () => window.removeEventListener(EVENTO, callback);
}

// O saldo aceita meia revisão (dever custa 0,5 desde a migration 008). Em
// pt-BR: "2,5" em vez do ponto decimal cru do JS ("2.5").
export function formatarRevisoes(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}
