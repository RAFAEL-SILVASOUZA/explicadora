# LESSONS

## Cores de superfície não são cores de texto
`secondary` (#FF8A3D) e `success` (#2EC4B6) ficam boas como fundo, borda e ícone, mas como texto
branco-sobre-cor não passam em AA (2.33:1 e 2.16:1). O sistema agora separa os dois papéis:
`*-light` (fundo) / `*` (superfície) / `*-ink` (texto). Toda vez que um token de superfície aparece
num `text-`, é um bug de contraste, não uma escolha de estilo.

## Um círculo para letra e número
A letra da alternativa e o número da questão eram desenhos diferentes em telas diferentes
(`A)` solto em QuestaoCard, `badge` em RespostaItem). Agora é `.chip` em todo o app. Elementos que
representam a mesma ideia precisam da mesma classe, não da mesma cor.

## Símbolo antes do texto funciona com criança de 7–14
Check/X antes do veredito não é redundância: a criança lê o símbolo antes de ler a palavra. Ícone
decorativo continua `aria-hidden` — o texto já nomeia o estado.

## Estado de carregamento não pode mostrar progresso que não existe
A barra em `/estudar` mostrava "Questão 1 de 1 · 100%" antes de as questões chegarem. Um estado de
espera comunica espera, não resultado.

## Navegação sem estado ativo não diz onde você está
O Header não tinha link ativo. Comparar só `pathname === href` deixa o link apagado dentro das
páginas filhas (`/revisoes/<id>`); casa prefixo. E `aria-current="page"` é o mínimo para quem não
vê a cor.

## Modal sem Esc é armadilha
`role="dialog"` + `aria-modal` sem fechamento por teclado é acessibilidade pela metade.

## Copy não promete mecânica que não existe
"Estude, ganhe pontos" prometia um placar que o produto não tem. Em app de criança, promessa de
mecânica ausente cria expectativa falsa — a copy segue o que existe.

## CSS: comentário é `/* */`, não `//`
Um `//` dentro de `@layer components` quebrou o build: postcss leu a linha como selector e caiu em
"Unexpected '/'". Comentário em arquivo `.css` usa a sintaxe do CSS, mesmo quando o resto do projeto
é TypeScript.

## Confete determinístico
Valores aleatórios por pedaço causariam divergência de hidratação. Posição e atraso dependem só do
índice. Camada decorativa: `aria-hidden`, `pointer-events-none`, `motion-reduce:hidden`.

## Verificar visualmente exige esperar o dado
Nas telas do app, screenshot logo depois de `navigate` captura o estado de carregamento, não o
conteúdo. Esperar o fetch antes de capturar é parte da verificação.

## Um número que a tela apresenta como fato precisa de fonte definida
"Quantidade usada" não é um campo do token: o movimento de consumo não guarda qual token o
financiou. O número é uma atribuição pela ordem de entrada do extrato (FIFO), e por isso mora em
um lugar só — a CTE do repositório, usada pela listagem e pela revogação. Se a regra de revogação
("até 2 usadas") fosse contada por um caminho diferente da coluna que mostra o número, as duas
discordariam na mesma tela.

## Teste de extrato precisa reproduzir o extrato, não só o saldo
O primeiro teste de atribuição criou a conta com saldo 3 sem o movimento `registro` que a rota de
cadastro escreve. Sem ele, o FIFO não tinha de onde atribuir o consumo e o teste passou pela razão
errada. Reproduzir o estado real é o que faz o teste discriminar a regra.

## UPDATE já trava a linha
`UPDATE ... FOR UPDATE` é sintaxe inválida em Postgres. O lock é opção de SELECT.

## Um mascote não pode ser a marca de outro produto
A coruja era a identidade visual de um produto conhecido. Um mascote é a cara do app: ele precisa
ser original, não parecido. O desenho novo foi construído a partir das formas do design system
(tokens de cor, silhueta legível em 32px), não a partir do ícone que a pessoa enviou — o ícone
também não é nosso.

## Um atributo que o componente não aceita é ignorado em silêncio
`aria-hidden="true"` escrito no JSX de um componente que só desestrutura `humor`, `className` e
`decorative` não faz nada: o SVG continuava na árvore de acessibilidade como `img` com um label
que repetia o texto da tela. Quando o componente tem uma prop para isso, a prop é o mecanismo —
dois caminhos para a mesma intenção sempre divergem.

## Comentário de bloco não pode ter o fechamento no meio do texto
Escrever `fill-*/stroke-*` dentro de um `/** ... */` fecha o comentário antes da linha terminar e
quebra o texto. Em comentário de bloco, o texto não pode conter o próprio delimitador.
