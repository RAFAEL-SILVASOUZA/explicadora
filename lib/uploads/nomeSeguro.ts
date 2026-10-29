// Nome seguro para gravar em uploads/: o navegador manda só o nome do arquivo,
// mas um cliente hostil pode mandar '../../arquivo' ou 'C:\segredo.png'. Regras:
// 1) basename depois de trocar \\ por / (cobre caminho Windows e Unix);
// 2) só letras, números, ponto, hífen e sublinhado; o resto vira _;
// 3) sem começar com ponto (mata '..' e dotfiles) e sem terminar em ponto
//    (Windows trata 'x.png.' como 'x.png').
// Se sobra string vazia, o arquivo não é gravado (o conteúdo já foi processado).
// Mora em lib/ e não na rota: um route.ts do Next só pode exportar handlers.
export function nomeSeguroParaUpload(nome: string): string | null {
  const base = nome.replace(/\\/g, '/').split('/').pop() || '';
  const limpo = base.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '').replace(/\.$/, '');
  return limpo.length > 0 ? limpo : null;
}
