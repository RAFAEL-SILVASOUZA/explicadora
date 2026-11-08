// Formatação de preço em reais a partir de cents (planos.preco_cents).
export function formatarPreco(cents: number): string {
  if (!cents) return 'Grátis';
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Tamanho legível para a biblioteca. O aluno não decide nada com "1572864 bytes":
// KB até 1 MB e MB acima disso, com uma casa.
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.ceil(kb))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

