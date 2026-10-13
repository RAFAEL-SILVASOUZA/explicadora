// Formatação de preço em reais a partir de cents (planos.preco_cents).
export function formatarPreco(cents: number): string {
  if (!cents) return 'Grátis';
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
