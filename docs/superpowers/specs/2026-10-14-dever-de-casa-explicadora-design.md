# Dever de Casa com Explicadora Visual (canvas + áudio)

Data: 2026-10-14
Status: aprovado em conversa, aguardando revisão escrita

## 1. Objetivo

Hoje o app só faz revisões: o pai sobe texto/PDF/fotos e a IA gera questões. Esta feature
acrescenta uma segunda área, "Deveres", em que o pai fotografa o dever de casa da criança e
recebe uma **explicação** dela, não as respostas.

A explicação é uma sequência animada desenhada em canvas em tempo de execução, narrada em
áudio. A criança assiste, ouve e depois resolve o dever no caderno.

Requisitos duros:

1. **Nunca revelar a resposta final do exercício.** Explicar conceito, método e um exemplo
   paralelo com valores diferentes.
2. **Áudio é o canal principal.** A criança de 8 a 14 anos não precisa ler para entender;
   texto na tela é apoio (título curto do passo), não o conteúdo.
3. **Canvas, não HTML gerado.** A IA devolve *dados* de cena; o app desenha. Nada de HTML,
   SVG ou JS arbitrário vindo do modelo.

Público: 3º ao 8º ano do Fundamental I/II (~8 a 14 anos). Faixa fixa na v1, embutida no
prompt; não há seletor de série no formulário.

## 2. Fora de escopo (v1)

- Interatividade da criança durante o passo (mini-checkpoints, rabisco livre, "tente você"
  com feedback da IA). A v1 é playback narrado: play/pause, passo anterior, repetir passo,
  próximo passo.
- Reconhecimento de fala / resposta por voz.
- Histórico de deveres do pai com analytics por disciplina.
- Saldo próprio para deveres. Usa o `saldo_revisoes` existente.
- Streaming da geração. A criação é uma requisição que termina quando tudo está pronto
  (mesma UX de "gerando questões" que já existe).

## 3. Arquitetura

### 3.1 Rotas e navegação

Área separada, sem misturar com revisões (mesma regra já aplicada a planos vs. revisões):

| Rota | Papel |
|---|---|
| `/deveres` | Grid dos deveres da conta + botão "Novo dever". Único lugar de listagem. |
| `/deveres/nova` | Formulário do pai. Criação exclusiva, como `/revisoes/nova`. |
| `/deveres/[id]` | Tela da criança: canvas + controles. |
| `POST /api/dever` | Criação (transação, saldo, LLM, áudio). |
| `GET /api/dever/[id]` | Storyboard do dono (para montar a tela). |
| `GET /api/deveres` | Grid da conta. |
| `GET /api/dever/[id]/audio/[ordem]` | WAV autenticado de um passo. |

`components/Header.tsx` ganha o link "Deveres" entre "Revisões" e "Créditos", com o mesmo
padrão de `navClass`/`aria-current`. Nenhum saldo, plano ou resgate aparece nessas telas:
créditos continuam exclusivos de `/creditos`.

### 3.2 Fluxo de criação

```
Pai em /deveres/nova
  → fotos/PDF/texto + título opcional
  → POST /api/dever (x-idempotency-key)
      autenticar
      comTransacao:
        1. chave já existe? devolve o dever existente, sem debitar (fast path)
        2. consumirSaldo (402 se esgotado)
        3. LLM de visão → storyboard (JSON validado por Zod)
        4. guarda anti-vazamento → regenera passo suspeito (até 2x)
        5. Piper: um WAV por narração → uploads/deveres/<id>/<ordem>.wav
        6. INSERT deveres + dever_passos (com duracao_ms real)
        7. vincularMovimentoADever
      commit
  → redirect /deveres/[id]
```

Falha em 3, 4 ou 5 faz o rollback: nenhum crédito é debitado. O áudio é gerado **antes** do
commit, dentro da mesma transação, no mesmo padrão de `POST /api/revisao` (a LLM já roda
dentro da transação hoje).

Detalhe de consistência: o sistema de arquivos não entra no rollback. Os WAVs são escritos
em `uploads/deveres/<deverId>/` e só ganham `audio_path` no INSERT. Se a transação falhar
depois da síntese, sobram arquivos órfãos no diretório do dever; como o `deverId` já estava
reservado para aquela tentativa, nada aponta para eles. Um script de limpeza
(`scripts/limpar-uploads-orfaos.ts`) remove pastas de dever sem linha em `deveres`.

### 3.3 Áudio no servidor, não no navegador

Decisão: Piper roda no servidor, uma vez, na criação. Motivos:

- A animação do canvas usa a **duração real** de cada narração (`duracao_ms`), então voz e
  desenho ficam sincronizados sem timing estimado.
- "Repetir esse passo" é instantâneo (toca o arquivo, não regenera).
- O aparelho da criança não precisa de performance para sintetizar fala.

Alternativas descartadas: Web Speech API no navegador (qualidade inconsistente entre
aparelhos, sem duração previsível) e TTS em nuvem (custo por uso e dado de criança saindo
da infraestrutura).

## 4. Contrato do storyboard

A LLM de visão recebe as imagens (mesmo `processarImagem`, 640px/JPEG) e o texto extraído
dos PDFs, e devolve JSON via `withStructuredOutput` (padrão já usado em `GerarQuestoesSchema`).

```ts
DeverStoryboard = {
  titulo: string,                 // curto, legível pelo pai na grid
  disciplina: string,             // ex.: "Matemática"
  resumo_para_pais: string,       // 2 frases; exibido só na área do pai
  passos: [
    {
      titulo: string,             // máx. 4 palavras
      narracao: string,           // 2 a 5 frases, tom da explicadora
      cena: Cena,
    }
  ]
}
```

Faixa esperada: 3 a 8 passos. Fora disso, o guard clampa para os primeiros 8 e loga.

### 4.1 Vocabulário de cena (fechado)

`Cena = { fundo: string, primitivos: Primitivo[] }`, com `Primitivo` uma `discriminated
union` de `kind`. A IA não pode inventar tipos; Zod rejeita o resto.

| kind | Uso pedagógico |
|---|---|
| `retangulo`, `circulo`, `linha`, `seta`, `texto`, `emoji` | construção geral |
| `reta_numerica` | números, posição, comparação, frações |
| `barra_modelo` | tape diagram, partes/todo, frações |
| `balanca` | igualdade, equações, "os dois lados iguais" |
| `blocos` | contagem, agrupamento, material dourado, moedas |
| `destaque` | pulso sobre uma região já desenhada |

**Coordenadas normalizadas** em 0..1 nos dois eixos. O renderizador multiplica pelo tamanho
efetivo do canvas: responsividade resolvida sem o modelo conhecer a tela.

Cada primitiva leva `aparece_em` (0..1, fração da duração do passo) e `animacao` em
`fade | desenhar | crescer | pular`. Linhas e setas usam `desenhar` (traço progressivo), o
resto usa as demais.

### 4.2 Regra anti-vazamento (duas camadas)

1. **Prompt.** Instrução explícita: explicar conceito e método, criar exemplo paralelo com
   valores diferentes, jamais enunciar o resultado do exercício fotografado.
2. **Guard verificado.** Segunda chamada LLM com schema
   `{ vaza_resposta: boolean, passo: number, motivo: string }` sobre o storyboard gerado.
   Se `vaza_resposta`, regenera só o passo indicado (máx. 2 tentativas). Se persistir, a
   `narracao` do passo é trocada por uma frase fixa do app ("Vamos praticar isso com os
   números do seu caderno.") e a cena é mantida, em vez de descartar o dever inteiro.

Espelha a estratégia já existente de `dicaRevelaResposta` em `lib/llm.ts`: o prompt não é
confiado sozinho, existe verificação mecânica e degradação graciosa.

## 5. Renderizador do canvas

Canvas 2D (`<canvas>` puro, escala por `devicePixelRatio`). Um único elemento; nenhuma
primitiva vira nó de DOM.

Motor de animação é uma **função pura**:

```
estadoDoPasso(cena, progresso) → [{ primitivo, progressoIndividual }]
```

O loop de `requestAnimationFrame` só chama isso e pinta. Consequências:

- Repetir passo = zerar progresso e tocar o WAV de novo; o desenho refaz idêntico.
- Duração do passo = `duracao_ms` do áudio. Sem constante chutada.
- Fallback: se o áudio estiver ausente, duração estimada por palavras
  (≈2,6 palavras/segundo) e legenda do passo na tela.

### 5.1 Acessibilidade

O canvas é `aria-hidden="true"` (decorativo). O conteúdo equivalente fica fora dele:

- Região `aria-live="polite"` com o título do passo atual.
- Botão "Ver texto" abre a transcrição completa de todos os passos.
- Controles são `<button>` reais, com rótulos e atalhos de teclado (espaço = play/pause,
  ← → = passos).
- `prefers-reduced-motion: reduce` desliga a animação: as primitivas entram prontas e o
  áudio continua. (O design system atual não tem suporte a essa preferência; aqui entra
  porque o movimento é o meio de comunicação, então precisa de alternativa.)

## 6. Modelo de dados

`migrations/005_deveres.sql`:

```sql
CREATE TABLE IF NOT EXISTS deveres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  titulo text,
  disciplina text,
  serie_ano text NOT NULL DEFAULT 'fundamental_i_ii',
  conteudo_texto text NOT NULL DEFAULT '',
  resumo_para_pais text,
  chave_idempotencia text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dever_passos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dever_id uuid NOT NULL REFERENCES deveres(id) ON DELETE CASCADE,
  ordem integer NOT NULL,
  titulo text NOT NULL,
  narracao text NOT NULL,
  cena jsonb NOT NULL,
  audio_path text,
  duracao_ms integer,
  UNIQUE (dever_id, ordem)
);

CREATE INDEX IF NOT EXISTS idx_deveres_conta ON deveres (conta_id, criado_em DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deveres_chave
  ON deveres (conta_id, chave_idempotencia) WHERE chave_idempotencia IS NOT NULL;

ALTER TABLE movimentos_saldo ADD COLUMN IF NOT EXISTS dever_id uuid REFERENCES deveres(id);
```

`serie_ano` existe como coluna para permitir faixa configurável depois, sem migrar de novo;
na v1 é constante.

`cena` entra como `jsonb` com o mesmo tratamento de `opcoes` em `questoes`
(`JSON.stringify` na escrita; `pg` devolve objeto na leitura).

### 6.1 Créditos e extrato

1 dever = 1 crédito, debitando `saldo_revisoes` por `consumirSaldo` dentro da transação.
A coluna `dever_id` em `movimentos_saldo` permite ao extrato de `/creditos` distinguir
consumo de revisão de consumo de dever, sem duplicar a mecânica de saldo. Novo helper
`vincularMovimentoADever` em `lib/repos/movimentos.ts`, espelhando
`vincularMovimentoARevisao`.

O badge do Header continua mostrando "N revisões" como saldo unificado.

### 6.2 Armazenamento de áudio

`uploads/deveres/<deverId>/<ordem>.wav`. Fora de `public/` (que é servido sem autenticação).
Entregue por `GET /api/dever/[id]/audio/[ordem]`, que chama `autenticar` e confere a posse
do dever antes de devolver os bytes. Áudio de uma criança não pode ser acessável por URL
descoberta.

## 7. Arquivos novos

Servidor:

- `lib/deveres/llm.ts` — `gerarStoryboard`, `revisarVazamento`
- `lib/deveres/cena.ts` — schemas Zod, clamp/descarte de primitiva fora de 0..1, limites
  (`MAX_PASSOS = 8`, máx. 24 primitivas por cena)
- `lib/deveres/piper.ts` — chamada ao binário local, um WAV por narração, leitura da duração
- `lib/deveres/timeline.ts` — duração do passo, progresso, fallback por palavras
- `lib/repos/deveres.ts` — CRUD, lookup por chave, listagem com resumo de passos
- `app/api/dever/route.ts`, `app/api/dever/[id]/route.ts`,
  `app/api/deveres/route.ts`, `app/api/dever/[id]/audio/[ordem]/route.ts`

Cliente:

- `components/deveres/DeverForm.tsx` — upload (mesmas regras de `RevisaoForm`: PDFs via
  `extrairTextoPDF`, imagens via `processarImagem`, `MAX_IMAGENS`)
- `components/deveres/DeverGrid.tsx`
- `components/deveres/CanvasExplicacao.tsx` — `<canvas>` + `requestAnimationFrame`
- `components/deveres/ControlesDever.tsx` — play/pause, anterior, repetir, próximo, "Ver texto"
- `app/deveres/page.tsx`, `app/deveres/nova/page.tsx`, `app/deveres/[id]/page.tsx`

`lib/llm.ts` não cresce: o código de dever fica em `lib/deveres/`, porque o arquivo já tem
258 linhas e as responsabilidades são distintas.

Configuração nova em `.env.example`:

```
PIPER_BIN=/caminho/para/piper
PIPER_MODEL=/caminho/para/pt_BR-faber-medium.onnx
```

## 8. Erros e degradação

| Situação | Comportamento |
|---|---|
| Saldo esgotado | 402 com a mesma mensagem de revisões, apontando para `/creditos`. |
| LLM fora do ar | 500 "Não consegui falar com a explicadora. Tente novamente." Nada debitado. Retry de conexão igual `comRetry`. |
| Storyboard inválido (Zod) | 3 tentativas como `gerarQuestoes`; depois 500, nada debitado. |
| Vazamento não corrigível | Dever criado com a narração do passo neutra; loga o `motivo`. |
| Piper ausente ou modelo não baixado | Dever criado sem áudio: `audio_path` nulo, tela da criança usa duração estimada + legenda. Log de aviso no servidor. Desenvolvimento não fica bloqueado por download de modelo. |
| Idempotência (mesma chave, corrida) | 23505 no índice único parcial → reconsulta e devolve o dever existente, um único débito. Igual a `004_idempotencia.sql`. |

## 9. Testes

Unitários (funções puras, `test/unit`, vitest já configurado):

- `lib/deveres/cena.ts`: primitiva fora de 0..1 é clampada ou descartada; cena com mais de
  24 primitivas é truncada; storyboard com mais de 8 passos é clampado; `kind` desconhecido
  é rejeitado.
- `lib/deveres/timeline.ts`: duração vem de `duracao_ms`; fallback por contagem de palavras;
  `progresso` fora de 0..1 é clampado.
- `estadoDoPasso`: primitiva com `aparece_em` maior que o progresso não aparece; `desenhar`
  progride linearmente; `prefers-reduced-motion` retorna progresso 1.
- Guarda anti-vazamento: entrada que reproduz o resultado do exercício é classificada como
  vazamento (casos fixos em tabela).

De banco (`test/db`, `--no-file-parallelism`): criação do dever + passos, idempotência por
chave, débito único, `movimentos_saldo.dever_id` preenchido, posse no lookup de áudio.

LLM (`lib/deveres/llm.test.ts`, padrão de `lib/llm.test.ts`): storyboard válido/inválido,
retry, regeneração de passo vazante.

Componentes (`components/deveres/*.test.tsx`, testing-library): formulário exige ao menos um
arquivo ou texto; controles emitem os eventos certos; "Ver texto" revela a transcrição.

## 10. Riscos conhecidos

- **Qualidade de visão do LLM local.** O modelo atual (`qwen3.8-flash-next-iq2_xs`) já é
  apertado para gerar questões; ler caligrafia infantil de foto pode ser pior. Mitigação:
  o formulário pede foto nítida e o erro de storyboard inválido é visível ao pai. Se a
  qualidade não fechar, trocar o modelo local é uma mudança de `.env`, não de código.
- **Latência da criação.** Visão + guarda + N sintetizações de Piper em série. Estimativa:
  dezenas de segundos para 5 passos. A tela de espera já existe para revisões
  (`LoadingQuestoes`); reusar com texto próprio.
- **Vocabulário visual limitado.** O canvas só desenha o que o renderizador conhece.
  Cresce por camada (uma primitiva nova = um `kind` no Zod + uma função de desenho + um
  teste), sem tocar no resto.
