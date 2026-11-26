# Leadership Lab: o teste por cenários

O teste do Lab é uma **trilha de cenários** de treinamento (3 por padrão), escolhidos pelo servidor a
partir do **público** da conta. Não há IA no caminho de quem responde. O teste de situações A/B/C
conduzido pela IA continua no código, atrás de uma chave, para reverter.

## Modo e configuração

| Variável             | Valor                           | Efeito                                              |
| -------------------- | ------------------------------- | --------------------------------------------------- |
| `LAB_TESTE_MODO`     | `cenarios` (padrão) ou `legado` | `cenarios`: a trilha. `legado`: as situações da IA. |
| `LAB_TESTE_CENARIOS` | inteiro de 1 a 10 (padrão 3)    | Quantos cenários compõem um teste.                  |

O painel (`GET /leadership-lab/painel`) informa `modoDoTeste`, e a tela escolhe a trilha ou o legado.
Em `cenarios`, `POST /sessoes` (teste da IA) responde 409 `LAB_MODO_CENARIOS`; em `legado`, a trilha
responde 409 `LAB_MODO_LEGADO`. O módulo do Lab continua dependendo de `LAB_IA_URL` (ou do modo
demonstração) para ligar, mesmo no modo por cenários.

## Quem faz o teste e com que origem

Todo perfil faz o próprio teste, desde que a conta esteja ligada a um colaborador (participante do Lab).

| Perfil         | Origem do resultado | Público                              |
| -------------- | ------------------- | ------------------------------------ |
| COMUM          | `participante`      | o da regra do cadastro (não escolhe) |
| DEV, ADMIN, RH | `interno`           | o da regra, ou o que escolherem      |

Resultado `interno` serve para validar e demonstrar: **não entra** em métrica, revisão nem comparação de
participantes (o filtro está nas consultas do servidor). Pode ser lido pelo dono, pelo RH, pelo ADMIN e
pelo DEV; nenhum COMUM o lê.

### Público da conta (nível de governança + área)

| Nível       | Área                         | Público                      |
| ----------- | ---------------------------- | ---------------------------- |
| supervisor  | Manutenção ou Administrativo | `supervisor-manutencao-adm`  |
| coordenador | Administrativo               | `coordenador-administrativo` |
| qualquer    | RH                           | `rh`                         |
| assistente  | Administrativo e demais      | `administrativo-geral`       |

Fora da tabela (por exemplo, coordenador de Compras), vale o nível: supervisor →
`supervisor-manutencao-adm`; coordenador e diretoria → `coordenador-administrativo`; assistente →
`administrativo-geral`. A tabela editável fica para a configuração (Fase 7). Conta COMUM sem cargo,
nível e área não inicia (`LAB_CADASTRO_INCOMPLETO`).

## Como o servidor monta e protege a trilha

- Escolhe cenários **aprovados** do público, **sem repetir** os já feitos pela pessoa; só quando os
  inéditos acabam, recomeça pelos feitos há mais tempo. Nunca repete um cenário na mesma trilha.
- **Nunca envia o gabarito** (`taken`, `beat`, regras, procedimentos). Cada resposta devolve só a reação
  da alternativa escolhida; o gabarito aparece no resultado, depois de concluir.
- Uma trilha em andamento por pessoa (índice único parcial). Iniciar de novo retoma; recarregar a página
  retoma na primeira pergunta sem resposta.
- Responder é idempotente: a mesma alternativa devolve o mesmo; outra para a mesma pergunta é 409.
  Respostas não mudam nem somem (gatilho no banco).
- Ao concluir cada cenário, o servidor calcula o desfecho com o motor de `packages/shared`. Ao concluir o
  último, grava o `resultado` do Lab: **aderência** = % de decisões cumpridas; **agilidade** compara o
  tempo de cada resposta com 60 s (referência); `experimental` enquanto houver texto de EXEMPLO.

## Rotas (prefixo `/api/v1/leadership-lab`)

| Rota                             | O que faz                                                           |
| -------------------------------- | ------------------------------------------------------------------- |
| `GET /teste/proxima`             | A trilha em andamento (com respostas dadas) ou o que iniciar faria. |
| `POST /teste`                    | Inicia (ou retoma). `{ publico? }` só para DEV, ADMIN e RH.         |
| `POST /teste/:id/respostas`      | Uma pergunta: `{ perguntaId, alternativa }` → só a reação.          |
| `POST /teste/:id/concluir`       | Conclui o cenário, abre o próximo ou fecha o teste.                 |
| `GET /teste/:sessaoId/resultado` | Resultado por cenários (também em `GET /sessoes/:id/resultado`).    |

## Dados

Migração `0024_lab_teste_cenarios` (aditiva, com `down.sql`): `sessao.modo` aceita `cenarios`;
`sessao.origem` e `sessao.publico`; tabelas `leadership_lab.tentativa_cenario` e `resposta_cenario`.

## Configuração (`/treinamentos/config`)

ADMIN e DEV editam; o RH só lê (lista, regras, quantidades e prévia). A API confere o perfil em toda
chamada. Tudo grava `AuditLog`.

- **Lista de cenários:** título, público, área, situação (rascunho, em revisão, aprovado), versão e
  última alteração. "Enviar para revisão" leva o rascunho a `em_revisao`; aprovar congela a versão.
- **Editor de JSON:** valida ao vivo com o mesmo schema do servidor e mostra os erros por caminho
  (`questions.2.alternatives.1.beat.title`). Aceita o formato do sistema e o do pacote do Lab. Pré-visualiza
  no Palco sem gravar resultado. Editar um cenário aprovado cria uma nova versão em rascunho.
- **Importar, exportar e aprovar em lote:** vários arquivos .json (um cenário ou uma lista cada), com
  relatório por arquivo e por cenário; tudo entra como rascunho. Exporta os selecionados. "Aprovar em lote"
  aprova a versão mais nova dos selecionados, com relatório por item.
- **Regra de público** (`treinamentos.regra_publico`): nível + área → público, ativa ou não. Vale a mais
  específica (nível e área, depois só a área, depois só o nível); em empate, a de cima. Os padrões da
  seção de contas entram como linhas iniciais; sem regra que sirva, vale o padrão do código.
- **Quantidade de cenários** (`treinamentos.teste_config`): por público e, se quiser, por turma (a da turma
  vale no lugar da do público). Sem linha, vale `LAB_TESTE_CENARIOS` (3).

Rotas (`/api/v1/treinamentos`): `POST /cenarios/:id/revisao`, `POST /cenarios/aprovar-em-lote`,
`GET|PUT /configuracao/regras`, `GET|PUT /configuracao/quantidades`, além das de cenários e importação.
Migração `0025_treinamentos_configuracao` (aditiva, com `down.sql`).

## Menu

O COMUM só tem o Leadership Lab. `/treinamentos`, `/colaboradores` e `/escalas` o levam para o Lab na
web; o fechamento das rotas antigas de Treinamentos na API fica para a Fase 9.

## Testes

Integração com banco real (`trilha/trilha.integration.test.ts`), tela (`lab-trilha-page.test.tsx`) e o
fluxo por teclado no Chromium: `LAB_E2E=1 pnpm --filter @my-flux/api test:e2e`
(`leadership-lab/e2e/trilha.e2e.test.ts`).
