DESIGN AUDIT — mudanças aplicadas (2026-10-13)

Design system (tailwind.config.js + app/globals.css)
- Tokens de texto acessíveis adicionados: secondary-ink #C2410C (5.2:1), success-ink #0F766E (5.5:1),
  danger-ink #B91C1C (6.5:1). secondary/success/danger continuam como cores de superfície.
- Token decorativo de jogo: star #FFC107 (troféu do resultado).
- Componente .chip criado (círculo A/B/C/D e número de questão — o mesmo em todo o app).
- .input: border-gray-200 → border-ink/15.
- Novo componente components/Confetti.tsx (usa a keyframe confetti-fall que existia sem uso),
  decorativo, aria-hidden, respeita prefers-reduced-motion.

Fase 1 — crítico
- app/page.tsx: "Hora de estudar" (ação principal) vem antes de Planos/Resgate; título do hero
  text-4xl; mascote ao lado do CTA.
- components/FeedbackResposta.tsx: texto em ink, borda de erro danger/40, ícone Check/X antes do
  h2, prop isLast → botão "Ver resultado!" na última questão (chamada em app/estudar/[id]).
- components/QuestaoCard.tsx: alternativas com .chip, border-ink/15, animate-pop-in ao selecionar;
  dica em secondary-ink; aria-busy no botão "Enviando...".
- app/offline/page.tsx: emoji → MascoteCoruja(triste), .btn-primary, Header incluído.
- components/CanvasModal.tsx: tokens, role="dialog" + aria-modal + aria-label, Esc fecha,
  foco no painel ao abrir.
- app/login/page.tsx: copy "Estude, ganhe pontos e resgate seu pacote" → "Estude e resgate seu
  pacote." (não existe mecânica de pontos).

Fase 2 — refinamento
- components/ProgressoBarra.tsx: marcos de 25/50/75/100% sobre a trilha; % com peso menor
  (text-base text-ink/50).
- components/Header.tsx: link ativo (usePathname, casa prefixo de páginas filhas) + ícones
  Home/BookOpen/User + aria-current="page".
- app/revisoes/page.tsx: estado vazio com mascote feliz e uma linha de ação.
- app/resultado/[id]/page.tsx: h2 "Pontuação" com Trophy em star; import de Dumbbell removido.
- aria-busy nos botões de login e cadastro.

Fase 3 — polimento
- Confetti no feedback de acerto e no resultado 100%.
- animate-wiggle no mascote "celebrando" (feedback e resultado).
- app/estudar/[id]: estado de carregamento usa LoadingQuestoes; a barra de progresso foi retirada
  desse estado (diria "Questão 1 de 1 · 100%" antes de existirem questões).

FUNÇÃO — área admin de códigos (2026-10-13)
- Free não gera códigos: o select do lote mostra só Pro/Família, a rota responde 400 para 'free',
  e a tela diz que o Free é concedido no cadastro.
- Coluna "Resgatado por" agora mostra o email e a quantidade usada daquele resgate. O consumo não
  guarda token_id (consumirSaldo insere sem token_id), então a quantidade vem da ordem de entrada
  do extrato (FIFO), numa CTE única do repositório usada pela listagem e pela revogação.
- Revogação de código resgatado só quando o uso é de até 2 créditos. O que sobra vira movimento
  'revogacao' no extrato e o saldo da conta é ajustado; o que foi usado não volta. Status 'revogado'.
- Busca incremental: filtra código, plano e email a cada tecla, com estado vazio próprio.
- Ícone de excluir só para código nunca resgatado; ícone de revogar só quando a ação é possível.
  Os dois confirmam na linha, sem diálogo do navegador.
- Migração 003: tokens.revogado_em e o CHECK de tipo ampliado para 'revogacao' (aplicada no banco
  de desenvolvimento).
- Testes: 69/69 em test/db, 31/31 em npm test. Verificado no navegador como admin (revogação de um
  código com 1 usada, recusa visual do código com 3 usadas, exclusão de um código livre).

Pendentes / fora do escopo de design
- Streak e contador de estrelas: mudança funcional (placar). Flag para o build agent.
- Som: fora do escopo.
- Observação funcional (não corrigida): em /resultado o percentual vem do recálculo enquanto o
  veredito vem do texto guardado — depois de "Segunda chance" eles divergem (83% vs "0 de 6").
- Verificado só em código, não visualmente: role/label/Esc do CanvasModal (precisa de questão
  não respondida para abrir o modal) e o estado vazio de /revisões (a conta de teste tem 1 revisão).

FUNÇÃO — área exclusiva de créditos (2026-10-13)
- Nova rota app/creditos/page.tsx: único lugar do app com saldo, plano atual, catálogo de pacotes,
  campo para colar o código e extrato. Reusa PlanosCard e ResgateTokenCard sem alterá-los.
- O que estava espalhado e saiu: app/page.tsx tinha PlanosCard + ResgateTokenCard (linhas 62-63) e
  app/conta/page.tsx tinha os dois + o extrato (linhas 80-115).
- app/page.tsx: ficou "Hora de estudar" + um card de atalho "Ver meus créditos". A home não faz mais
  fetch de /api/planos (o useEffect de planos e o callback carregarPlanos foram removidos junto).
- app/conta/page.tsx: virou só o cadastro (nome, e-mail, conta desde). Não faz mais fetch de
  /api/planos nem lê movimentos. /api/conta não mudou de contrato: a página só deixou de usar os
  campos de crédito que a rota devolve.
- components/Header.tsx: link "Créditos" (CircleDollarSign) entre Revisões e Minha conta. O helper
  ativo() já casa prefixo, então o link fica aceso em /creditos sem mudança extra.
- Testes: components/Creditos.test.tsx (2 novos: a tela reúne saldo+plano+resgate+extrato; resgate
  envia o código e mostra o novo saldo). O teste da home em RevisaoForm.test.tsx passou a assertar
  o atalho e a AUSÊNCIA do campo "Código do pacote". 43/43 em npm test; npx tsc --noEmit limpo.
- Spec atualizada: tabela de páginas e a linha de "plano atual" agora citam /creditos.
- Não verificado no navegador: as três telas (sem servidor MCP de browser neste ambiente).
- Pendência de copy (não tocada, é texto de API): o 402 de app/api/revisao/route.ts:79 e de
  app/api/revisao/[id]/avancar/route.ts:46 diz "Resgate um token para continuar" sem apontar para
  /creditos.

MASCOTE — personagem original (2026-10-13)
- components/MascoteCoruja.tsx → components/Mascote.tsx. A coruja era a identidade visual de
  outro produto; o app agora tem um personagem próprio: "Lia", uma menina de cabelo bob com
  franja, desenhada em SVG original (não um traçado do ícone que o usuário enviou — o desenho é
  construído do zero com as formas do design system). As cinco expressões do prop humor continuam.
- Novo token de personagem: skin #F7D9C2 (rosto). Decorativa, nunca cor de texto.
- O SVG passou a usar as utilidades fill/stroke do Tailwind (tokens) em vez de hex hardcoded.
- As 12 chamadas passaram a usar a prop `decorative` em vez de `aria-hidden="true"` escrito no
  JSX: o componente não aceitava esse atributo, então ele era ignorado e o SVG entrava na árvore
  de acessibilidade como img com um label que repetia o texto da tela. Agora há um mecanismo só.
- Copy que nomeava a coruja: /offline, estado vazio de /revisões e o subtítulo da home agora
  nomeiam a personagem. "O que o professor diz" → "O que a Lia diz" (resultado e detalhe de
  revisão); "O professor está preparando as questões..." → "A Lia está preparando as questões..."
  (LoadingQuestoes, e o teste que assertava esse texto acompanhou a mudança).
- Verificado no navegador: feliz (login, home, Header em 32px), pensando (estado de carregamento),
  triste (/offline), celebrando (/resultado). `neutro` não é usado por nenhuma tela hoje — é só o
  default do prop.
