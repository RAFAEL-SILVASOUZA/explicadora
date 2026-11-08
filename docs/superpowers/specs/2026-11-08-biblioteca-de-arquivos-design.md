# Biblioteca de arquivos do aluno

Data: 2026-11-08. Status: implementada.

## Problema

Revisões e deveres recebem arquivos a cada criação (`FormData` com campo `arquivos`). O mesmo
material (a foto da página do caderno, a apostila em PDF) precisa ser reenviado toda vez. A rota
de revisão já gravava os bytes em `uploads/<nome>` sem registro: arquivo sem dono, sem id, sem
remoção, e nomes iguais se sobrescreviam.

## Decisão

Uma biblioteca por conta. O upload acontece uma vez, fica registrado, e as outras telas
referenciam o arquivo pelo `id` em vez de reenviar os bytes.

Decisões fechadas com o usuário:

1. **Biblioteca no servidor com ids.** Bytes em disco + linha na tabela `arquivos` (dono, nome,
   mime, tamanho, hash). Revisão/dever enviam só os ids; o servidor lê o arquivo na hora.
2. **Sem cota por conta.** Limite por arquivo (10 MB) e por envio (40 arquivos), que protegem a
   memória do processo, não o espaço do aluno.
3. **Mesmos formatos de hoje:** PNG, JPG, JPEG, WEBP e PDF.
4. **Auto-arquivamento:** todo arquivo enviado dentro de "Nova revisão" ou "Novo dever" vira item
   da biblioteca. Nada precisa ser reenviado nunca.

## Modelo de dados (`migrations/006_arquivos.sql`)

```
arquivos(
  id uuid PK,
  conta_id uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome text NOT NULL,          -- nome que o cliente mandou, saneado; só para exibir
  mime text NOT NULL,
  tamanho integer NOT NULL,    -- bytes
  caminho text NOT NULL,       -- uploads/biblioteca/<contaId>/<id>.<ext>, com barras
  hash text NOT NULL,          -- sha256 do conteúdo, para deduplicar
  origem text NOT NULL,        -- 'biblioteca' | 'revisao' | 'dever'
  criado_em timestamptz NOT NULL DEFAULT now()
)
```

- `caminho` usa barras explícitas, não `path.join` (mesma lição de `lib/deveres/piper.ts`: o valor é
  gravado no banco e relido em outro SO; backslash do Windows não é separador no Linux).
- Índice `(conta_id, criado_em DESC)`, como `idx_deveres_conta`.
- **Sem índice único em `hash`.** O dedupe é um SELECT antes do INSERT. Uma corrida entre dois
  envios iguais duplica o arquivo em disco, o que não corrompe nada; um índice único devolveria 500
  para o aluno que enviou a mesma foto duas vezes.
- `ON DELETE CASCADE`: excluir a conta remove as linhas; os bytes ficam para
  `scripts/limpar-uploads-orfaos.ts` estender depois (fora do escopo daqui).

## Tipos de arquivo: bytes mandam, não a extensão

`lib/uploads/tipos.ts` decide o tipo pelo *magic number* (PNG `\x89PNG`, JPEG `FF D8 FF`,
WEBP `RIFF....WEBP`, PDF `%PDF`). Um cliente que renomeia `.exe` para `.png` é recusado. A
extensão gravada vem do tipo detectado, nunca do nome que o cliente mandou, então o caminho gravado
é sempre `<uuid>.<ext>` e traversal é impossível por construção.

Validação do `contaId`/`id` com regex de uuid antes de montar caminho (defesa em profundidade,
mesmo padrão de `sintetizarPassos`).

## Upload e dedupe

Fluxo de `POST /api/arquivos` (um `FormData` com N arquivos):

1. tamanho ≤ 10 MB, senão recusa aquele arquivo (resposta por arquivo, os demais entram);
2. tipo detectado por magic number, senão recusa;
3. `hash = sha256(buffer)`; se a conta já tem um arquivo com aquele hash, devolve o existente com
   `duplicado: true` e **não grava bytes novos**;
4. INSERT da linha; se o INSERT falhar, apaga o arquivo escrito (nunca sobra órfão).

Ordem escrita→linha com limpeza no `catch`: o sistema de arquivos não entra na transação do
Postgres, então o caminho inverso (linha→arquivo) deixaria linha apontando para arquivo inexistente
se a escrita falhasse.

## Reuso nas outras telas

`lib/uploads/materiais.ts` (`coletarMateriais`) centraliza o que hoje está duplicado nas duas
rotas. Para cada fonte, na ordem em que chegaram:

- campo `arquivos` (bytes novos): valida, grava e registra na biblioteca com a `origem` da rota;
- campo `arquivoIds` (ids já na biblioteca): resolve a linha **com `conta_id = auth.contaId`** no
  WHERE (um id de outra conta devolve 400, não 500), lê do disco e processa.

Saída: `conteudo` (texto + PDFs extraídos por `extrairTextoPDF`) e `imagens` (`processarImagem`,
limite `MAX_IMAGENS` compartilhado entre as duas fontes). Erros de leitura de um arquivo são
somados em `avisos` e não derrubam a criação: o material restante continua válido.

## Rotas

| Rota | Comportamento |
| --- | --- |
| `POST /api/arquivos` | upload em lote; responde `{ criados, duplicados, recusados }` |
| `GET /api/arquivos` | lista da conta, mais recente primeiro |
| `GET /api/arquivos/[id]/conteudo` | bytes, autenticado, posse no WHERE, `Vary: Authorization` |
| `DELETE /api/arquivos/[id]` | remove linha e arquivo do disco |

O conteúdo passa por rota autenticada (mesmo motivo do áudio do dever): `uploads/` fica fora de
`public/` porque `public/` é servido sem autenticação. `cache-control: private`.

Excluir um arquivo não desfaz revisões e deveres já gerados: o texto e as imagens daquela criação
já foram processados e persistidos no resultado. A referência é por id só no momento da criação.

## Interface

- `/arquivos`: página com área de upload (mesma mecânica multi-seleção dos formulários) e lista com
  ícone por tipo, nome, tamanho em KB, data e botão remover. Estado vazio com a mascote, como as
  outras grids.
- `Header`: link "Arquivos" entre Deveres e Créditos, com o prefixo ativo que o repo já usa.
- `Nova revisão` e `Novo dever`: seção "Usar arquivos da minha biblioteca" com a lista da conta em
  checkboxes; os selecionados vão como `arquivoIds`. O envio de arquivos novos continua igual e
  passa a arquivar automaticamente.

Contraste segue os tokens existentes (`*-light` para superfície, `*-ink` para texto, regra de
LESSONS.md).

## Testes

- `test/db/arquivos-route.test.ts`: 401; criação grava linha + bytes; dedupe por hash não grava
  bytes repetidos; lista mostra só a conta da sessão; conteúdo de outra conta devolve 404; recusa
  arquivo acima do limite e tipo inválido; DELETE remove linha e arquivo.
- `test/unit/tiposArquivo.test.ts`: magic number de PNG/JPEG/WEBP/PDF e um executável renomeado
  para `.png`.
- `test/db/revisao-route.test.ts` e `dever-route.test.ts`: `arquivoIds` de fora da conta devolvem
  400; material arquivado automaticamente ao criar (origem `revisao` / `dever`).
- `components/Biblioteca.test.tsx`: upload chama a rota, remover confirma e chama DELETE.
- `components/RevisaoForm.test.tsx` e `DeverForm.test.tsx`: marcar um arquivo da biblioteca envia o
  id em `arquivoIds` junto dos bytes novos.
- `test/db/migrations.test.ts` e `test/db/helper.ts`: tabela `arquivos` no baseline.

## Fora de escopo (v1)

Pré-visualização em modal, cota por plano, "usado em" (qual revisão usou qual arquivo),
extensão do `limpar-uploads-orfaos.ts` para `uploads/biblioteca`, e formatos além dos atuais.