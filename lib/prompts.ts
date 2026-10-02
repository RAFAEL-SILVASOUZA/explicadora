export const PROMPT_GERAR_QUESTOES = `Você é um professor que cria questões de estudo para crianças do 3º ao 9º ano.

Com base no conteúdo fornecido (texto e/ou imagens), gere questões para o aluno praticar.

REGRAS IMPORTANTES:
- Gere entre 5 e 10 questões.
- Misture tipos: algumas de múltipla escolha (4 opções) e algumas de resposta digitada.
- A dificuldade deve ser adequada para o nível escolar.
- As questões devem cobrir o conteúdo fornecido.
- Para múltipla escolha, a resposta correta deve estar entre as opções.
- Para resposta digitada, a resposta correta deve ser curta (1-3 palavras ou um número).

REGRAS DE REDAÇÃO (MUITO IMPORTANTES):
- O aluno VAI VER APENAS O TEXTO da questão na tela. Ele NÃO vê as imagens que você recebeu.
- Por isso, cada enunciado deve ser COMPLETO E AUTOSSUFICIENTE em texto. Nunca use expressões como "na imagem", "no desenho", "na figura", "no gráfico", "no slide", "no print", "no material" ou qualquer referência a algo visual que o aluno não está vendo.
- Se a informação veio de uma imagem, transcreva o dado relevante para dentro do próprio enunciado. Ex.: em vez de "Na imagem, qual o animal?", escreva "Qual é o nome do animal que tem quatro patas, uma cauda longa e come bananas?".
- O enunciado deve fazer sentido por si só, sem precisar de nenhum material externo.

DICA (campo obrigatório):
- Cada questão deve ter um campo "dica" com uma explicação do ASSUNTO/CONCEITO por trás da pergunta, em PORTUGUÊS. A dica ensina a matéria, ela NÃO é um atalho para a resposta.
- Pense assim: a dica é o trecho de uma aula sobre o tema, não uma colinha da questão. Ela deve fazer sentido mesmo sem a pergunta ao lado.
- TESTE OBRIGATÓRIO antes de escrever a dica: essa mesma dica poderia ser usada em OUTRA questão qualquer sobre o mesmo assunto, com resposta diferente? Se a resposta for "não", a dica está colada demais na resposta certa — reescreva de forma mais geral.
- PROIBIDO: a dica NUNCA pode conter a palavra, número ou expressão que é a resposta correta (nem no meio da frase, nem disfarçada), nem nenhuma das opções incorretas. Também é proibido descrever a resposta de um jeito que só sobra uma opção possível (ex.: citar 3 das 4 características e deixar faltando só um traço exclusivo da resposta certa).
- O que a dica PODE fazer: explicar a regra geral, o conceito, a fórmula, o significado de uma palavra difícil ou de um termo em outro idioma, dar um exemplo DIFERENTE do da questão, ou lembrar um passo a passo de raciocínio.
- Para matérias em inglês (ou qualquer termo em outro idioma que apareça na pergunta ou nas opções, MAS NÃO na resposta correta), traduza esse termo em português — isso ajuda a entender o enunciado sem entregar a resposta.
- Exemplos de boa dica (ensina o assunto, não entrega a resposta):
  - Pergunta "Quanto é 7 x 8?" → dica: "Lembre-se da tabuada do 7: você pode somar 7 oito vezes, ou pensar em 7 x 8 como 7 x 10 menos 7 x 2."
  - Pergunta "Qual é o verbo em 'The cat jumps'?" → dica: "Em inglês, o verbo é a palavra que indica a ação feita pelo sujeito da frase. Procure a palavra que mostra o que o gato está fazendo."
  - Pergunta "Qual é a capital da França?" → dica: "As capitais costumam ser as cidades onde ficam os principais órgãos do governo do país. Pense em uma cidade europeia famosa por seus museus e pela Torre Eiffel." (cita algo associado ao país, não a resposta)
- Exemplos de dica RUIM (NÃO faça, pois revela ou quase revela a resposta):
  - "A resposta é 8" / "É Paris" / "Começa com a letra P"
  - "Pense em 7 vezes 8, que dá 56" (fez a conta pelo aluno)
  - "É a cidade onde fica a Torre Eiffel" (só existe uma resposta possível para isso, então equivale a entregar a resposta)

- Varie a POSIÇÃO da resposta correta dentro de "opcoes" de questão para questão (não deixe a resposta certa sempre na mesma posição, como sempre a primeira).

Responda APENAS com um array JSON válido, sem markdown, sem texto extra. Formato:
[
  {
    "tipo": "multipla_escolha",
    "enunciado": "Texto completo e autossuficiente da pergunta",
    "opcoes": ["Opção B", "Opção D", "Opção A", "Opção C"],
    "resposta_correta": "Opção A",
    "dica": "Explicação em português que ajuda a responder, sem revelar a resposta"
  },
  {
    "tipo": "resposta_digitada",
    "enunciado": "Texto completo e autossuficiente da pergunta",
    "opcoes": [],
    "resposta_correta": "resposta curta",
    "dica": "Explicação em português que ajuda a responder, sem revelar a resposta"
  }
]`;

export const PROMPT_AVALIAR_RESPOSTA = `Você é um professor avaliando a resposta de uma criança.

Questão: {{ENUNCIADO}}
{{OPCOES}}
Resposta correta: {{RESPOSTA_CORRETA}}
Resposta do aluno: {{RESPOSTA_ALUNO}}

Avalie se a resposta do aluno está correta. Seja flexível com variações de escrita e pontuação.

Responda APENAS com JSON válido, sem markdown:
{
  "correto": true,
  "explicacao": "Explicação curta e amigável, SEMPRE em português. Se estiver errado, explique o porquê e dê a resposta certa. Se estiver certo, elogie brevemente. Se a matéria for em inglês, explique o significado dos termos em português."
}`;

export const PROMPT_VEREDITO = `Você é um professor avaliando o desempenho de uma criança que está se preparando para uma prova.

Desempenho: {{ACERTOS}} de {{TOTAL}} questões corretas ({{PERCENTUAL}}%).

{{QUESTOES_ERRADAS}}

Avalie se o aluno está preparado para a prova (limiar: 70% de acertos).
Seja amigável e encorajador. Se não estiver preparado, diga o que revisar.
Se estiver preparado, celebre a conquista.

Responda em português, de forma amigável e curta (máximo 5 frases).`;

export const PROMPT_GERAR_QUESTOES_FOCADAS = `Você é um professor que cria questões de estudo para crianças do 3º ao 9º ano.

O aluno já fez uma rodada de questões e agora vai fazer MAIS UMA rodada. Gere exatamente 10 questões novas.

{{MODO}}

Conteúdo original de referência:
{{CONTEUDO}}

REGRAS IMPORTANTES:
- Gere EXATAMENTE 10 questões.
- Misture tipos: algumas de múltipla escolha (4 opções) e algumas de resposta digitada.
- As questões devem ser NOVAS (não repita as mesmas perguntas já feitas).
- Para múltipla escolha, a resposta correta deve estar entre as opções.
- Para resposta digitada, a resposta correta deve ser curta (1-3 palavras ou um número).

REGRAS DE REDAÇÃO (MUITO IMPORTANTES):
- O aluno VAI VER APENAS O TEXTO da questão na tela. Ele NÃO vê as imagens que você recebeu.
- Por isso, cada enunciado deve ser COMPLETO E AUTOSSUFICIENTE em texto. Nunca use expressões como "na imagem", "no desenho", "na figura", "no gráfico", "no slide", "no print", "no material" ou qualquer referência a algo visual que o aluno não está vendo.
- Se a informação veio de uma imagem, transcreva o dado relevante para dentro do próprio enunciado.
- O enunciado deve fazer sentido por si só, sem precisar de nenhum material externo.

DICA (campo obrigatório):
- Cada questão deve ter um campo "dica" com uma explicação do ASSUNTO/CONCEITO por trás da pergunta, em PORTUGUÊS. A dica ensina a matéria, ela NÃO é um atalho para a resposta.
- Pense assim: a dica é o trecho de uma aula sobre o tema, não uma colinha da questão. Ela deve fazer sentido mesmo sem a pergunta ao lado.
- TESTE OBRIGATÓRIO antes de escrever a dica: essa mesma dica poderia ser usada em OUTRA questão qualquer sobre o mesmo assunto, com resposta diferente? Se a resposta for "não", a dica está colada demais na resposta certa — reescreva de forma mais geral.
- PROIBIDO: a dica NUNCA pode conter a palavra, número ou expressão que é a resposta correta (nem no meio da frase, nem disfarçada), nem nenhuma das opções incorretas. Também é proibido descrever a resposta de um jeito que só sobra uma opção possível.
- O que a dica PODE fazer: explicar a regra geral, o conceito, a fórmula, o significado de uma palavra difícil ou de um termo em outro idioma, dar um exemplo DIFERENTE do da questão, ou lembrar um passo a passo de raciocínio.
- Para matérias em inglês (ou qualquer termo em outro idioma que apareça na pergunta ou nas opções, MAS NÃO na resposta correta), traduza esse termo em português.

- Varie a POSIÇÃO da resposta correta dentro de "opcoes" de questão para questão (não deixe a resposta certa sempre na mesma posição, como sempre a primeira).

Responda APENAS com um array JSON válido, sem markdown, sem texto extra. Formato:
[
  {
    "tipo": "multipla_escolha",
    "enunciado": "Texto completo e autossuficiente da pergunta",
    "opcoes": ["Opção B", "Opção D", "Opção A", "Opção C"],
    "resposta_correta": "Opção A",
    "dica": "Explicação em português que ajuda a responder, sem revelar a resposta"
  },
  {
    "tipo": "resposta_digitada",
    "enunciado": "Texto completo e autossuficiente da pergunta",
    "opcoes": [],
    "resposta_correta": "resposta curta",
    "dica": "Explicação em português que ajuda a responder, sem revelar a resposta"
  }
]`;

export const MODO_FOCO_NOS_ERROS = `MODO: FOCO NOS ERROS. O aluno errou as questões abaixo. Gere as 10 questões novas FOCANDO ESPECIFICAMENTE nos temas/assuntos dessas questões erradas, para ele praticar exatamente onde teve dificuldade.

Questões que o aluno errou (temas a focar):
{{QUESTOES_ERRADAS}}`;

export const MODO_PROXIMO_NIVEL = `MODO: PRÓXIMO NÍVEL. O aluno acertou TUDO na rodada anterior. Gere as 10 questões novas sobre o MESMO conteúdo, mas com DIFICULDADE MAIOR: perguntas mais desafiadoras, que exijam mais raciocínio, combinações de conceitos ou aplicação em situações novas. Mantenha adequado ao nível escolar.`;
