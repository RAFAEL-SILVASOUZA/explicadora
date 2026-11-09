import { MAX_CARACTERES_NOME_ARQUIVO } from '../constantes';

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

// --- Nome exibido na biblioteca (renomeio) -------------------------------------
// O renomeio muda só a coluna de exibição: a chave no object storage é o id, não
// o nome. Por isso o nome editável é o radical ('prova-logica'), e a extensão
// ('png') fica fixa na tela e é recomposta pelo servidor a partir da linha atual
// — o cliente nunca manda a extensão.

// Mesma tecla do sanitizador de upload: só letras, números, hífen e sublinhado.
// Sem espaço e sem ponto — o ponto é justamente a fronteira da extensão, que o
// aluno não edita. A validação rejeita em vez de silenciar: quem digita 'minha
// prova' merece saber o porquê do 400, não descobrir um nome com '_' do nada.
const RAIZ_NOME_RE = /^[A-Za-z0-9_-]+$/;

export function ehRaizNomeValida(raiz: string): boolean {
  return (
    raiz.length >= 1 &&
    raiz.length <= MAX_CARACTERES_NOME_ARQUIVO &&
    RAIZ_NOME_RE.test(raiz)
  );
}

// Separa o nome exibido em radical e extensão pelo último ponto ('a.b.pdf' fica
// 'a.b' + 'pdf'). Nome sem ponto ('arquivo', o fallback do upload) e nome que só
// tem extensão ('.png', que o sanitizador jamais produz) vêm com extensão vazia.
export function dividirNomeExibicao(nome: string): { raiz: string; extensao: string } {
  const i = nome.lastIndexOf('.');
  if (i <= 0) return { raiz: nome, extensao: '' };
  return { raiz: nome.slice(0, i), extensao: nome.slice(i + 1) };
}

export function montarNomeExibicao(raiz: string, extensao: string): string {
  return extensao ? `${raiz}.${extensao}` : raiz;
}
