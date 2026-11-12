# Leadership Lab — banco de dados

Módulo de treinamento de gestores do MY FLUX. Este documento cobre a **Etapa 1 (banco de dados)**. As demais etapas acrescentam seções aqui.

## Schemas

| Schema              | Quem cria as tabelas     | Conteúdo                                                                         |
| ------------------- | ------------------------ | -------------------------------------------------------------------------------- |
| `leadership_lab`    | Prisma (`schema.prisma`) | 17 tabelas do módulo e a view `vw_painel_participante`                           |
| `leadership_lab_ia` | O serviço de IA (Python) | Sessões do Google ADK. A migração só cria o schema vazio; o Prisma não o enxerga |

As tabelas do RH continuam em `public`. Nenhuma ganhou coluna: `User`, `Employee` e `JobFunction` só ganharam campos virtuais do Prisma (relações inversas), sem alteração no banco. O `schema.prisma` usa `multiSchema`, por isso todo modelo e enum tem `@@schema(...)`; **novos modelos precisam do seu**.

## Decisões de modelagem

- **`participante`** liga um login (`User`) a um colaborador (`Employee`), um para um. Todas as tabelas do módulo apontam para ele. Não existe vínculo `User`↔`Employee` no RH, e `Employee` não tem e-mail, então o vínculo é cadastrado pelo RH.
- **`molde_cargo`** mapeia um cargo do RH (`JobFunction`) para um molde. Uma função pertence a no máximo um molde.
- **`permissao_usuario`** guarda `lab_gestao` e `lab_especialista` por usuário (as tabelas `Permission`/`RolePermission` do RH são por perfil e não são usadas pelo código). Revogar apaga a linha; o histórico fica em `AuditLog` (`PERMISSION_CHANGE`).
- **Valores fechados são `TEXT` + `CHECK`**, não enums do Postgres. As listas do código estão em `packages/shared/src/leadership-lab.ts`, e um teste confere que banco e código dizem o mesmo.
- **Regras de domínio no banco**, para valerem mesmo que algum código as esqueça: escala de aderência (100, 70, 40, 10, 0); 0 só por tempo esgotado; alerta vermelho se, e somente se, aderência 10; sempre 3 respostas; marco é a situação 3; campo livre só é gravado depois da Guarda (texto bloqueado nunca é gravado); resultado só deixa "aguardando validação" com quem validou e quando; ajuste exige justificativa; encerrar alerta exige a nota da conversa.
- **Moldes entram inativos e sem tempo limite.** O tempo por situação é decisão de negócio em aberto; o banco recusa ativar um molde sem tempo.
- **Só o modo `dinamico` existe no piloto.** `validado` e `teste_versao_id` entram na versão 1, com as tabelas de testes validados.
- **Colunas de ator** (`validado_por`, `tratado_por`, `decidido_por`, `criado_por`...) são o UUID do usuário sem FK, a mesma convenção de `createdBy`/`updatedBy` do restante do repositório. A trilha completa fica em `AuditLog`.
- **FKs `RESTRICT`** por padrão (nada some em cascata); `CASCADE` só em tabelas de ligação. A política de retenção, ainda em aberto com o jurídico, definirá como expurgar.
- **`log_ia` é uma tabela comum**, indexada por data, sem partição mensal: para 8 a 12 líderes o volume não justifica. Particionar quando houver volume.

## Operação

Aplicar (mesmo fluxo de produção, `prisma migrate deploy`):

```bash
pnpm --filter @my-flux/api exec prisma migrate deploy
```

Desfazer. O Prisma Migrate não executa descida, então o arquivo é aplicado à mão. É **destrutivo** (apaga os dados do Lab) e atômico; ele falha, sem desfazer nada, se o serviço de IA já criou tabelas em `leadership_lab_ia`:

```bash
psql -v ON_ERROR_STOP=1 -f apps/api/prisma/migrations/0015_leadership_lab/down.sql "$DATABASE_URL"
```

As migrações seguintes têm o próprio `down.sql`, aplicado do mesmo jeito e em ordem inversa à de subida (0017, 0016, 0015). O da 0017 só devolve a definição anterior da view do painel e não toca em dados.

Papel de banco do serviço de IA (menor privilégio: só enxerga `leadership_lab_ia`). Rodar uma vez por ambiente, com usuário administrador, depois da migração. O script explica como criar o usuário de login, com a senha vinda do Secret Manager:

```bash
psql -v ON_ERROR_STOP=1 -f apps/api/prisma/ops/leadership-lab-roles.sql "$DATABASE_URL_ADMIN"
```

## Testes de integração

Usam um PostgreSQL real e criam um banco descartável por suíte. Sem `LAB_TEST_DATABASE_URL` são ignorados, não falham. Com o banco embutido do projeto:

```bash
node scripts/local-db.mjs
```

```bash
LAB_TEST_DATABASE_URL=postgresql://my_flux:my_flux_local@127.0.0.1:55432/postgres pnpm --filter @my-flux/api test
```

O usuário precisa poder criar bancos e papéis (superusuário, no banco embutido).

### Teste de ponta a ponta no navegador

`apps/api/src/modules/leadership-lab/e2e/`. Sobe a API de verdade, o PostgreSQL, o front compilado (servido pela mesma origem, como em produção) e o serviço de IA falso por HTTP, e dirige o Chromium com o Playwright: um participante entra, aceita o termo, faz um teste inteiro pelo teclado, vê o resultado e o painel atualizado; recarregar no meio do teste volta à mesma situação, sem começar outro; um usuário RH não vê o Lab; no celular não há rolagem horizontal. Precisa do Chromium (`pnpm --filter @my-flux/api exec playwright install chromium`) e leva uns 20 segundos. Não roda no `pnpm test` comum:

```bash
LAB_TEST_DATABASE_URL=postgresql://my_flux:my_flux_local@127.0.0.1:55432/postgres pnpm --filter @my-flux/api test:e2e
```

Com `LAB_E2E_SHOTS=<pasta>`, salva uma captura de tela de cada etapa.

## Cálculos

`packages/shared/src/leadership-lab-calculos.ts`. Funções puras, sem banco nem relógio: a IA propõe a aderência de cada escolha e **todos os indicadores são calculados aqui**. Valores gravados e exibidos saem com 2 casas; o nível usa a média sem arredondar.

| Função                     | O que faz                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `calcularResultado`        | Fecha o teste: aderência geral, agilidade, nível por skill, estilo, flexibilidade, alertas vermelhos |
| `medirResposta`            | Tempo medido no servidor, descontada a tolerância de rede (`LAB_TOLERANCIA_TEMPO_S`); diz se esgotou |
| `agilidadeDoTurno`         | `max(0; 1 − tempo ÷ limite) × 100`; tempo esgotado conta 0                                           |
| `nivelDaMedia`             | 90+ = 5, 70–89 = 4, 50–69 = 3, 25–49 = 2, abaixo de 25 = 1                                           |
| `classificarFlexibilidade` | alta a partir de 80%, média a partir de 40%, baixa abaixo disso                                      |
| `analisarEstilos`          | Estilo predominante e flexibilidade de um conjunto de escolhas (de um teste, ou de vários juntos)    |
| `deveGerarAlertaAmarelo`   | Mesma skill com média abaixo de 50 nos dois últimos testes                                           |
| `podeExibirTendencia`      | Tendência e tipo de perfil só depois de 3 testes                                                     |

A entrada é validada com as mesmas regras do banco (escala de aderência; aderência 0 só com tempo esgotado). Entrada incoerente lança `LabCalculoError`.

### Onde a documentação deixa lacunas

Cada leitura abaixo está marcada com `INTERPRETAÇÃO` no código. São decisões de negócio para confirmar:

1. **Faixas de nível.** "70 a 89" é lido como o intervalo contínuo [70, 90), porque a média não é inteira (89,5 é nível 4).
2. **"Escolhas que envolveram a equipe"** = situações respondidas em que `estilo` não é nulo. Tempo esgotado é omissão, não decisão, e fica fora de estilo e flexibilidade.
3. **Empate no estilo mais frequente.** Não se escolhe um em silêncio: `estiloPredominante` fica nulo e os empatados vão em `estilosEmpatados`. Com 5 situações o empate é comum; falta definir o desempate. A mesma regra vale para o perfil do painel, que junta as escolhas de vários testes (`analisarEstilos`).
4. **"Dois testes seguidos" (alerta amarelo).** A série da skill deve ter só os testes em que ela teve evidência, e a função olha os dois últimos. Quem consulta o histórico decide também se resultados ainda não validados entram. Como `média < 50` equivale a `nível ≤ 2`, a consulta pode usar `perfil_skill.nivel`.
5. **Skills de uma situação com tempo esgotado**, se houver, contam com aderência 0.
6. **Limite de tempo.** Chegar exatamente no limite ainda vale; a tolerância de rede é descontada uma vez.

## Permissões

A matriz fica em `packages/shared/src/leadership-lab-acesso.ts` (pura, o front pode consultá-la para montar o menu). O backend a aplica com `assertAcesso`, em `apps/api/src/modules/leadership-lab/lab-access.ts`, e monta o ator com `carregarAtorLab`, em `lab-actor.ts`.

**Não usa a hierarquia DEV > ADMIN > RH > COMUM.** Lá um perfil mais alto herda o que o mais baixo faz; aqui seria uma falha, porque ADMIN e DEV não usam dados de perfil e o curador não é participante.

| Papel           | Quem é                                         | Alcança                                                                |
| --------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| `participante`  | perfil COMUM                                   | Só os próprios dados: termo, testes, painel, resultado, contestação    |
| `curador`       | perfil RH                                      | Dados individuais, só de quem está nas turmas ativas que ele acompanha |
| `administrador` | perfis ADMIN e DEV                             | Configuração de moldes e tempos. Nenhum dado de pessoa                 |
| `gestao`        | permissão `lab_gestao` (qualquer perfil)       | Só agregados                                                           |
| `especialista`  | permissão `lab_especialista` (qualquer perfil) | Nada no piloto (versão 1: testes, nunca perfis)                        |

Cada ação da matriz diz quais papéis a executam e **que dados cada um alcança** (`proprios`, `turma`, `escopo-do-rh`, `agregados`, `configuracao`). Testes verificam a estrutura: nenhuma ação dá dado de pessoa a gestão, administrador ou especialista, e a tabela de resultados esperados cobre todas as ações.

Respostas HTTP:

- **403** `LAB_FORBIDDEN` quando o perfil não pode a ação (inclusive DEV); **403** `LAB_SEM_VINCULO` quando o usuário COMUM ainda não foi ligado a um colaborador.
- **404** `LAB_NOT_FOUND`, com mensagem idêntica à de recurso inexistente, quando a sessão ou o resultado é de outra pessoa ou de fora das turmas do curador. Assim a resposta não revela que o registro de um colega existe.
- O escopo `turma` **falha fechado**: sem o conjunto de participantes da turma, o acesso a uma pessoa é negado.

Uso em uma rota, sempre depois de carregar o recurso:

```ts
const user = await authenticateRequest(request, users);
const ator = await carregarAtorLab(prisma, user);
const sessao = await repositorio.buscar(id); // 404 se não existir
assertAcesso(ator, "sessao:responder", { participanteId: sessao.participanteId });

// Curador: precisa do conjunto de participantes das suas turmas.
const participantesDasTurmas = await carregarParticipantesDasTurmas(prisma, user.id);
assertAcesso(ator, "resultado:ler", { participanteId, participantesDasTurmas });
```

Listagens (`revisao:listar`, `alerta:listar`...) não têm alvo: a matriz só confere o papel, e **a consulta** deve filtrar pelas turmas do curador (`participantesDasTurmas`).

### Decisões de negócio embutidas

1. **Só o perfil COMUM faz testes.** RH, ADMIN e DEV não são participantes: o curador não valida o próprio resultado, e quem administra não gera dado de perfil. Se um RH também for líder e precisar fazer o teste, é decisão do negócio.
2. **DEV não é exceção.** Ao contrário do restante do sistema, DEV não vê dados de perfil nem faz as ações de curador. Para investigar problemas, usa a configuração e os logs técnicos.
3. **`lab_gestao` e `lab_especialista` valem para qualquer perfil**, concedidas explicitamente; nenhum perfil as recebe por padrão.

## Contrato com o serviço de IA

`apps/api/src/modules/leadership-lab/ia/ia-contrato.ts`. **A IA propõe; o backend valida, calcula e decide.** Tudo o que volta do serviço passa por aqui antes de tocar o banco, o cálculo ou o participante, e tudo o que vai para ele sai de um schema estrito: o schema é a lista fechada de campos que podem chegar à IA, então nome, matrícula, e-mail, unidade ou ids do RH não passam sem mudar o arquivo (e o teste que fixa a lista).

Os schemas são estritos de propósito: campo desconhecido ou ausente é violação do contrato. Se o serviço real divergir, a divergência aparece no primeiro teste de contrato.

### O que é da documentação e o que é proposta

| Peça                                                                                  | Origem                                                                                                    |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| JSON do turno (`tipo`, `avaliacao_anterior`, `consequencia`, `situacao`, `resultado`) | **Documentação** (`turnoIaSchema`)                                                                        |
| Regras do jogo: 3 opções, aderência na escala, alerta vermelho só com aderência 10    | **Documentação**                                                                                          |
| Resultado sem números (os números vêm do backend)                                     | **Documentação**                                                                                          |
| Bloco `uso` em cada resposta                                                          | **Documentação** diz que existe; os campos e o nível no envelope são **proposta**                         |
| Resposta da Guarda, corpos das requisições, `contribuicoes` do resultado              | **Proposta**: a documentação só diz "seguir, mascarar ou bloquear" e "cargo, temas, situações e escolhas" |

A proposta, para alinhar na Etapa 2 com o `agent.py` real:

- `POST /teste/sessoes` recebe `{ molde, temas, numero_situacoes }` e devolve `{ sessao_id, ...turno da situação 1, uso }`. O `sessao_id` é opaco e fica em `sessao.ia_sessao_id`. O backend não envia id de usuário.
- `POST /teste/turnos` recebe `{ sessao_id, numero, escolha, tempo_esgotado, texto_livre }` e devolve `{ ...turno, uso }`.
- `POST /agentes/guarda` recebe `{ texto }` e devolve `{ decisao, texto, uso }`: `texto` é nulo em `seguir` (o backend usa o que enviou) e em `bloquear`, e é o texto mascarado em `mascarar`.
- `uso` = `{ agente, modelo, versao_instrucao, tokens_entrada, tokens_saida }`.

### Regras que o contrato impõe

- **Turno.** `avaliacao_anterior` só é nula na situação 1. A situação 1 não tem consequência; da segunda em diante, tem. A avaliação é da situação imediatamente anterior. O marco é a situação 3, e só ela. Sempre 3 opções, A, B e C, nessa ordem.
- **Aderência.** Só a escala 100, 70, 40, 10 e 0. O 0 existe apenas sem escolha (tempo esgotado), e sem escolha só vale 0. Alerta vermelho se, e somente se, a aderência é 10. O alerta amarelo não vem da IA: é do backend.
- **Skills** devem ser as do piloto, sem repetição.
- **Contra o que o backend esperava** (`validarTurnoIa`): a IA não pode avaliar outra situação nem outra letra que a enviada (nem tratar omissão como resposta), pular ou repetir situações, encerrar o teste antes da última nem prolongá-lo.
- **Resultado.** `resumo`, `ponto_forte`, `ponto_desenvolvimento`, `sugestoes` e `contribuicoes`. Qualquer campo numérico (aderência geral, níveis...) é rejeitado.
- **Avisos** não rejeitam a resposta, só são devolvidos para monitorar a IA. Hoje há um: situação com mais de 60 palavras.

### Guarda: falha fechada

`aplicarGuarda` nunca lança e nunca devolve texto que não passou pela Guarda. Erro, tempo esgotado, JSON estranho, decisão desconhecida, `seguir` com texto trocado pela IA, `bloquear` devolvendo texto: tudo vira `bloquear`. A saída combina com a restrição do banco: só há texto quando a decisão é `seguir` ou `mascarar`.

### Do contrato para o banco (Etapa 3)

| No contrato                                         | Vai para                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `sessao_id` (abertura)                              | `sessao.ia_sessao_id`                                                                                   |
| `situacao`                                          | `turno` (numero, marco, texto, opcoes, estilo_adequado)                                                 |
| `avaliacao_anterior`                                | `turno` da situação respondida (aderencia, estilo, alerta, justificativa); skills em `turno_skill`      |
| `consequencia`                                      | `turno.consequencia` da situação respondida                                                             |
| `avaliacao_anterior.contribuicao`                   | `contribuicao` (uma por turno)                                                                          |
| `resultado`                                         | `resultado` (resumo, ponto_forte, ponto_desenvolvimento, sugestoes); resposta completa em `resposta_ia` |
| `uso` e a duração da chamada                        | `log_ia`                                                                                                |
| aderência, agilidade, níveis, estilo, flexibilidade | **calculados pelo backend** (`calcularResultado`), nunca vêm da IA                                      |

## Motor do teste

`apps/api/src/modules/leadership-lab/motor/`. Conduz um teste de ponta a ponta. O motor recebe o ator (`LabAtor`) e um `ClienteIa` (interface em `cliente-ia.ts`). Em produção o cliente é o `ClienteIaHttp`; nos testes, a `IaFalsa`, que obedece ao contrato e valida o que recebe. As rotas HTTP (seção seguinte) são finas: autenticar, `carregarAtorLab`, chamar o motor.

| Método                              | Faz                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| `situacaoDoTermo(ator)`             | A versão atual do termo e se este participante já a aceitou                            |
| `aceitarTermo(ator)`                | Registra o aceite da versão atual do termo (idempotente)                               |
| `listarMoldes(ator)`                | Os moldes, com o do cargo do participante marcado                                      |
| `iniciar(ator, {moldeId?})`         | Inicia um teste, ou retoma o que está em andamento                                     |
| `estadoDoTeste(ator)`               | Só LÊ o teste em andamento (nunca inicia um, nunca chama a IA, nunca grava)            |
| `responder(ator, id, entrada)`      | Registra a resposta; devolve consequência e próxima situação, ou o resultado           |
| `tempoEsgotado(ator, id, {numero})` | O cliente avisa que o relógio zerou; o servidor confere                                |
| `obterResultado(ator, id)`          | Resultado de um teste concluído (do participante, ou de quem está na turma do curador) |
| `painel(ator)`                      | O painel do participante (seção "Painel do participante"): só testes concluídos        |

As pré-condições de início ficam num só lugar, `avaliarInicio` (`precondicoes.ts`): `iniciar`, `listarMoldes` e o botão do painel decidem "pode iniciar agora? se não, por quê?" pela mesma função, na mesma ordem (termo, teste em andamento, cargo, mapeamento do cargo, molde pronto, limite diário). Assim a tela não promete o que `POST /sessoes` recusaria.

### Garantias (todas com teste de integração contra PostgreSQL real)

- **Permissão em todo método**, antes de ler ou gravar. Sessão inexistente, mal formada e alheia respondem o mesmo 404.
- **Aderência escondida.** Durante o teste a resposta tem só: número, marco, texto, opções, consequência, tempo limite e tempo restante. As visões (`visoes.ts`) são montadas campo a campo, nunca espalhando a linha do banco, então coluna nova não vaza sozinha. Só depois do último turno o participante vê aderência por situação, agilidade, níveis e justificativas.
- **Tempo medido no servidor.** Resposta fora do prazo (mais a tolerância) vale como omissão: a letra e o campo livre são descartados e a IA nem os vê. O aviso de "tempo esgotado" do cliente só vale se o relógio do servidor concorda. Recarregar a página não zera o relógio.
- **Idempotência.** Reenviar a mesma resposta devolve o mesmo resultado sem nova chamada à IA; outra resposta para a mesma situação é recusada (409).
- **Uma chamada à IA por turno, mesmo com requisições simultâneas.** Quem reserva o turno (`processando_ate`) segue; a outra recebe 409 "em processamento". A reserva expira sozinha se o processo morrer.
- **Falha da IA não perde a resposta.** A resposta e o tempo ficam gravados; o participante repete (ou reabre o teste) e o motor conclui com o que já estava gravado.
- **Resposta da IA fora do contrato não grava nada** (nenhuma avaliação, skill, alerta ou situação), e vai para o `log_ia` como `CONTRATO`.
- **Dado pessoal não chega à IA.** Uma auditoria de uma partida inteira confere que nome, matrícula, e-mail, ids do RH e o id do banco não aparecem em nenhuma requisição, e que cada chamada só carrega os campos do contrato.
- **Alerta vermelho nasce na hora**, no turno com aderência 10, não no fim do teste. O amarelo é calculado ao fechar.

### Estados de uma situação

| Estado                    | No banco                                        | O que acontece                                                     |
| ------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| Pendente                  | sem `respondida_em`                             | Espera a resposta; o relógio corre desde `apresentada_em`          |
| Respondida, sem avaliação | `respondida_em` preenchido, sem `justificativa` | A IA ainda não aplicou (falhou, ou está em curso). Repetir conclui |
| Avaliada                  | `justificativa` preenchida                      | Repetir devolve o que está gravado                                 |

### Erros

| Código                                                                       | HTTP | Quando                                                                              |
| ---------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------- |
| `LAB_FORBIDDEN`                                                              | 403  | Perfil sem permissão (inclui DEV e ADMIN)                                           |
| `LAB_SEM_VINCULO`                                                            | 403  | Usuário COMUM ainda não ligado a um colaborador                                     |
| `LAB_TERMO_PENDENTE`                                                         | 403  | Termo de ciência da versão atual não aceito                                         |
| `LAB_NOT_FOUND`                                                              | 404  | Sessão inexistente, mal formada, de outra pessoa ou de fora das turmas              |
| `LAB_SEM_TESTE_EM_ANDAMENTO`                                                 | 404  | `GET /sessoes/atual` sem nenhum teste em andamento                                  |
| `LAB_CARGO_NAO_INFORMADO`, `LAB_MOLDE_NAO_MAPEADO`, `LAB_MOLDE_INATIVO`      | 409  | O cargo não leva a um molde ativo, com tempo e temas                                |
| `LAB_MOLDE_DIVERGENTE`                                                       | 422  | O molde confirmado não é o do cargo                                                 |
| `LAB_LIMITE_DIARIO`                                                          | 429  | Limite de testes por dia atingido                                                   |
| `LAB_TURNO_FORA_DE_ORDEM`, `LAB_RESPOSTA_DIVERGENTE`, `LAB_SESSAO_ENCERRADA` | 409  | Situação que não é a atual; resposta já dada de outra forma; teste cancelado        |
| `LAB_EM_PROCESSAMENTO`                                                       | 409  | Outra requisição está processando este turno. Tentar de novo em instantes           |
| `LAB_TEMPO_NAO_ESGOTADO`                                                     | 409  | O cliente avisou antes do prazo (traz `tempoRestanteMs`)                            |
| `LAB_TESTE_EM_ANDAMENTO`                                                     | 409  | Resultado pedido antes do fim                                                       |
| `LAB_IA_INDISPONIVEL`, `LAB_IA_RESPOSTA_INVALIDA`                            | 502  | A IA não respondeu / respondeu fora do contrato. O participante pode tentar de novo |

### Variáveis de ambiente

| Variável                    | Obrigatória?                  | Para quê                                                                                       |
| --------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `LAB_IA_URL`                | **É o interruptor do módulo** | Endereço do serviço de IA. Sem ela, o módulo fica desligado (rotas inexistentes, 404)          |
| `LAB_IA_TOKEN`              | sim, se `LAB_IA_URL` existe   | Segredo enviado em `X-Servico-Token`. O mesmo valor de `TOKEN_SERVICO` do serviço de IA        |
| `LAB_TOLERANCIA_TEMPO_S`    | sim, se `LAB_IA_URL` existe   | **Sem valor padrão.** Segundos de latência de rede descontados do tempo de resposta (0 = nada) |
| `LAB_LIMITE_TESTES_DIA`     | não                           | Testes por participante por dia. Sem ela, sem limite                                           |
| `LAB_IA_TIMEOUT_MS`         | não                           | Tempo máximo de cada chamada à IA. Padrão 25 000; fica abaixo dos 30 s do cliente web          |
| `LAB_MODO_DEMO`             | não                           | `true` liga o **modo demonstração** (veja a seção própria). Só vale sem `LAB_IA_URL`           |
| `LAB_IA_AUTENTICACAO`       | não                           | `cloud-run`: cada chamada leva o ID token da conta de serviço do site (serviço de IA privado)  |
| `LAB_EXIGE_BASE_VALIDADA`   | não                           | `true`: resultado experimental (situação sem base validada) não pode ser validado como oficial |
| `LAB_LIMITE_CONVERSAS_HORA` | não                           | Mensagens por participante por hora no espaço de aprendizagem. Padrão 30                       |

Ligado e mal configurado, o servidor **não sobe** e diz o que falta, em vez de começar a falhar na frente do participante. Desligado, o resto do sistema sobe exatamente como antes.

## Rotas HTTP

`apps/api/src/modules/leadership-lab/lab-routes.ts`, sob `/api/v1/leadership-lab`. Mesmo JWT do restante do sistema. Sucesso: `{ "data": ... }`. Erro: `{ "code", "message", "details" }`, pelo tratador global. Toda resposta do módulo, inclusive de erro, sai com `Cache-Control: no-store`.

| Rota                               | Faz                                               |
| ---------------------------------- | ------------------------------------------------- |
| `GET /termo`                       | `{ versaoAtual, aceito, aceitoEm }`               |
| `POST /termo`                      | Aceita a versão atual                             |
| `GET /moldes`                      | `{ moldes: [...], meuMoldeId }`                   |
| `POST /sessoes`                    | Inicia, ou retoma; corpo opcional `{ moldeId? }`  |
| `GET /sessoes/atual`               | Lê o teste em andamento; nunca inicia um          |
| `POST /sessoes/:id/respostas`      | `{ numero, escolha: "A"\|"B"\|"C", textoLivre? }` |
| `POST /sessoes/:id/tempo-esgotado` | `{ numero }`                                      |
| `GET /sessoes/:id/resultado`       | O resultado de um teste concluído                 |
| `GET /painel`                      | O painel do participante                          |

- Corpos com campo desconhecido (como `aderencia`) são recusados com 400; o corpo de cada POST tem teto de 16 KB.
- Sessão inexistente, mal formada ou de outra pessoa respondem o mesmo 404.
- Repetir uma requisição de resposta devolve **exatamente o mesmo corpo**.
- `GET /sessoes/atual` devolve a situação em que o participante parou (com o tempo que resta, calculado no servidor) ou, se a resposta já foi dada mas a IA ainda não a avaliou, `{ tipo: "em-processamento" }`. Existe porque `POST /sessoes` também retoma, mas **começaria** um teste (e o relógio da situação 1) se não houvesse nenhum em andamento, por exemplo numa aba esquecida.
- As rotas dos cadastros do RH (participantes e turmas) e da configuração dos moldes estão em "Cadastros do RH e configuração dos moldes (Etapa 5A)", mais abaixo. A curadoria e a contestação estão em "Curadoria do RH e contestação do participante (Etapa 5B)". Ainda não há a gestão (agregados).

### Cliente HTTP da IA

`ClienteIaHttp` chama `POST /teste/sessoes`, `POST /teste/turnos` e `POST /agentes/guarda`, com o token em `X-Servico-Token`. **Não segue redirecionamento** (o token nunca vai para um endereço que o operador não configurou), limita o tamanho da resposta, aplica o tempo limite também à leitura do corpo, e nenhuma mensagem de erro carrega o corpo da resposta, a credencial ou o token. O endereço deve ser `https` fora de uma rede privada.

Se o serviço estiver no Cloud Run sem acesso público, o gancho `autorizacao` fornece o ID token (cabeçalho `Authorization: Bearer`). Ele não está ligado a nada ainda, porque depende de onde o RH roda (Railway ou Cloud Run), decisão em aberto: no GCP basta o servidor de metadados; fora dele é preciso uma chave de conta de serviço ou Workload Identity Federation.

### Decisões que tomei e o negócio pode rever

1. **Um teste em andamento por participante** (índice no banco). Iniciar de novo retoma o mesmo, sem nova chamada à IA e sem zerar o relógio.
2. **Sem valor padrão para a tolerância de rede.** O valor muda a nota de quem responde no limite e a documentação não o define; o motor se recusa a subir sem ele.
3. **"Hoje", para o limite diário, é o dia em `America/Sao_Paulo`.** Teste cancelado não conta. O limite em si segue em aberto (sem limite se a variável não existir).
4. **O alerta amarelo não deduplica entre testes**: dispara em cada teste que cumpre a regra, mesmo que o anterior ainda esteja aberto.
5. **O aviso de tempo esgotado é aceito quando o relógio bruto do servidor passa do limite**, sem descontar a tolerância (a tolerância só vale para respostas, a favor do participante).
6. **O campo livre tem teto de 1000 caracteres**: proteção contra abuso (o texto vai para a Guarda e para a IA, que cobram por token), não regra pedagógica.
7. **A resposta durante o teste inclui `tempoRestanteMs`**, além do que a documentação lista, para o relógio sobreviver a um recarregamento.
8. **A versão do termo (`2026-1`) é um marcador**: o texto do termo ainda não existe.
9. **Migração 0016** (`ux_sessao_em_andamento_por_participante` e `turno.processando_ate`), com `down.sql`.
10. **Migração 0017** (a view do painel só conta alertas de testes concluídos), com `down.sql`. Veja "Painel do participante".
11. **`GET /sessoes/atual` não exige o termo aceito**: ler o próprio teste em andamento não revela nada novo, e quem decide se pode iniciar é `POST /sessoes`.

## Painel do participante

`GET /painel`, em `apps/api/src/modules/leadership-lab/painel/`: `tipos.ts` (o que sai), `montagem.ts` (as regras, puras, sem banco) e `consulta.ts` (a leitura). Só o participante (perfil COMUM) o acessa, e só vê o próprio painel (`painel:ler`). Sem o termo aceito o painel responde normalmente e o botão vem `indisponivel` (motivo `termo-pendente`), para a tela poder mostrar o termo.

**Regra central: o painel só enxerga testes concluídos.** A aderência é escondida durante o teste e o alerta vermelho nasce na hora (para o curador ser avisado); mostrá-lo no painel antes do fim revelaria a avaliação no meio do teste. O teste em andamento aparece só como a ação `continuar` (id, número da situação em que o participante parou e total), sem nenhum dado de avaliação.

| Bloco          | O que traz                                                                         | Regra                                                                                  |
| -------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `termo`        | `{ versaoAtual, aceito, aceitoEm }`                                                | Para a tela mostrar o termo no primeiro acesso                                         |
| `acao`         | O botão: `iniciar`, `continuar` ou `indisponivel` (com o motivo)                   | O mesmo estado que `POST /sessoes` usa para decidir                                    |
| `indicadores`  | Testes feitos e validados, aderência e agilidade médias, data do último teste      | Médias de todos os testes concluídos, validados ou não; 2 casas                        |
| `evolucao`     | Um ponto por teste concluído, do mais antigo ao mais novo, e `tendenciaDisponivel` | Tendência só depois de 3 testes. No máximo os 100 testes mais recentes                 |
| `skills`       | As 8 skills do piloto, em ordem fixa (4 hard e 4 soft)                             | Nível mais recente de cada uma, o validado pelo curador se houver. Sem evidência: nulo |
| `tipoDePerfil` | Estilo predominante, distribuição dos 4 estilos, flexibilidade                     | Só depois de 3 testes; antes disso nenhum dado de estilo sai do banco                  |
| `alertas`      | Alertas abertos de testes concluídos                                               | Vermelhos primeiro, depois os mais recentes; no máximo 100                             |
| `sugestoes`    | Até 3, as do debriefing do teste mais recente                                      | Com a origem: qual teste, e se já foi validado                                         |

Motivos de `indisponivel`: `termo-pendente`, `cargo-nao-informado`, `molde-nao-mapeado`, `molde-inativo` e `limite-diario` (este com `limiteDiario`). São os mesmos erros que `POST /sessoes` devolveria.

### Como a leitura é feita

- **Uma transação `REPEATABLE READ`.** Todos os blocos vêm do mesmo instante do banco. Sem isso, um teste que concluísse no meio da leitura deixaria o cartão dizendo "3 testes" e o gráfico com 4 pontos. Um teste de integração conclui um teste no meio da leitura e confere que o painel continua coerente.
- **Os indicadores vêm da view `vw_painel_participante`**, que a modelagem reservou para isso. A **migração 0017** a corrigiu: `alertas_abertos` contava alertas de testes em andamento, o que revelaria no meio do teste que a última escolha teve aderência 10. Agora conta só os de testes concluídos (mesmas colunas, `CREATE OR REPLACE VIEW`; o `down.sql` devolve a definição da 0015).
- **Toda leitura exige `sessao.status = 'concluida'`**: evolução, skills, escolhas de estilo, alertas e sugestões. Os alertas vêm de uma só consulta SQL com junções: pedir ao Prisma três relações irmãs dentro de uma transação faz ele carregá-las em paralelo na mesma conexão, e o driver `pg` avisa que vai deixar de aceitar isso.
- **O tipo de perfil só é lido quando pode ser exibido.** Antes de 3 testes, as escolhas de estilo nem saem do banco.
- **Cada bloco é montado campo a campo** (`montagem.ts`), então coluna nova não vaza sozinha.

### Duas definições únicas

- `avaliarInicio` decide "pode iniciar agora? se não, por quê?" para `POST /sessoes`, `GET /moldes` e o botão do painel. A tela nunca promete o que o servidor recusaria.
- `analisarEstilos` (em `packages/shared`) define estilo predominante e flexibilidade, tanto no resultado de um teste quanto no perfil do painel. Se o perfil usasse outra regra, mostraria um estilo diferente do que o resultado do teste mostra.

### Decisões do painel que o negócio pode rever

1. **Radar = o nível mais recente de cada skill**, não uma média ao longo do tempo. Mostra o validado pelo curador quando existe; senão o calculado, com `validado: false` (selo "aguardando validação"). O nível calculado e o resultado de origem vão junto, para o participante poder contestar.
2. **Tipo de perfil = as escolhas de todos os testes concluídos, juntas**, e não a média dos estilos de cada teste. Empate: `estiloPredominante` nulo e os empatados em `estilosEmpatados` (o item 3 de "Onde a documentação deixa lacunas").
3. **Tendência: o servidor entrega a série e a regra de liberação (3 testes), não uma direção calculada.** A documentação não diz como a tendência se calcula (último contra o anterior? contra a média dos anteriores? regressão?).
4. **A média da turma não entra.** É um agregado: depende de definir a turma e o mínimo de pessoas por recorte (veja Pendências). Quando decidido, entra como um bloco novo.
5. **O próximo teste é sempre o do cargo do participante.** O painel não oferece escolha de molde (o `moldeId` de `POST /sessoes` só confirma o do cargo, e outro dá 422).
6. **Teste em andamento não conta em nada** (indicadores, radar, perfil, alertas, sugestões): só aparece como "continuar".
7. **Sem texto de orientação nos alertas.** O painel traz a cor, a skill ou a situação e o teste de origem; o "o que fazer" de cada alerta é decisão de negócio em aberto.
8. **100 pontos de evolução e 100 alertas** são proteção contra resposta gigante, não regra de negócio.

## Front do participante (Etapa 4)

`apps/web/src/features/leadership-lab/` (cliente, regras da tela, componentes) e `apps/web/src/pages/lab/` (as três páginas). Só o perfil COMUM vê o item **Leadership Lab** no menu e cai em `/lab` ao entrar; os demais perfis seguem para Colaboradores, como antes. O servidor é quem barra os outros perfis (403): esconder o item é só arrumação do menu.

| Rota                       | Tela                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `/lab`                     | Painel: termo de ciência (se pendente), botão do teste, indicadores, evolução, radar de skills, estilo, alertas e dicas |
| `/lab/teste`               | O teste: mapa do caminho, cronômetro, situação, opções 1, 2 e 3 e campo livre                                           |
| `/lab/resultado/:sessaoId` | Resultado de um teste concluído                                                                                         |

### Como a tela do teste se comporta

- **Abrir ou recarregar só lê** (`GET /sessoes/atual`). Quem começa um teste é o clique em "Iniciar teste" (`POST /sessoes`): abrir o endereço, voltar no histórico ou recarregar nunca inicia um teste nem o relógio da situação 1.
- **Escolher não envia.** As teclas 1, 2 e 3 (ou o clique) marcam A, B ou C, e a resposta só vai em "Confirmar resposta" (ou Enter), porque ela não pode ser trocada depois. Dentro do campo livre, os números são texto.
- **O cronômetro só mostra.** Conta a partir de quando a situação chegou ao navegador, com o tempo que o servidor informou, então recarregar não devolve tempo. Ao zerar, avisa o servidor, que confere com o relógio dele; se o do navegador estiver adiantado, a tela volta a contar pelo do servidor. O leitor de tela é avisado em 30 s, em 10 s e no fim, não a cada segundo.
- **Uma chamada de cada vez.** Enquanto uma resposta ou o aviso de tempo esgotado está a caminho, a tela fica travada e uma segunda chamada não sai (as duas juntas dariam "resposta divergente").
- **Falha da IA não perde nada.** A tela mostra o motivo e "Tentar de novo" reenvia a mesma resposta, que o servidor reconhece. Se a página for recarregada nesse estado, a leitura devolve `em-processamento` e a tela oferece "Continuar teste", que retoma com a resposta já gravada.
- **A aderência nunca aparece durante o teste.** A tela só recebe número, marco, texto, opções, consequência e tempo. A consequência da escolha anterior vem junto da situação nova, na mesma tela, porque o relógio da nova já está correndo.

### O contrato com a API

Os formatos das respostas são schemas Zod em `packages/shared/src/leadership-lab-api.ts`, usados nas duas pontas. O front valida cada resposta e descarta o que não é do contrato, então um campo de avaliação que vazasse da API nunca chegaria a uma tela. A API prova, nos testes de integração, que uma partida inteira obedece aos schemas, e um teste confere que os códigos de erro do servidor são exatamente os que a tela sabe tratar.

### Peso do bundle

As três páginas e a biblioteca de gráficos (Recharts, só linha e radar) são carregadas sob demanda: o restante do sistema não paga por elas. `"sideEffects": false` em `packages/shared` impede que o Zod dos schemas entre no pacote principal.

### Modo de teste: sem login (temporário)

Por decisão do dono do sistema, **para o primeiro momento de teste o front não pede login**: todo visitante entra como o usuário DEV do seed (`dev@myflux.local`), como era antes da Etapa 4. Isto vale em produção, e a senha de demonstração vai no pacote. Quem abre o endereço tem acesso de DEV (escopo global: dados de todos os colaboradores e gestão de usuários).

Nesse modo o item **Leadership Lab** aparece no menu para qualquer perfil, para ser encontrado. Como o DEV não faz testes, a página dele diz isso e traz a dica de entrar como `comum@myflux.local` (botão "Ir para o login"). Com o modo de teste desligado, o item volta a aparecer só para o perfil COMUM.

Para voltar a exigir login, construa o front com `VITE_MODO_TESTE_SEM_LOGIN=false` (ou mude o padrão em `App.tsx`): a tela de login volta e o e-mail do usuário DEV sai do pacote (conferido). O teste de ponta a ponta comum já constrói o front assim, porque exercita o login de verdade.

## Modo demonstração

Enquanto o serviço de IA real não existe, o servidor pode rodar o Lab com uma **IA de exemplo**, para mostrar as telas funcionando de ponta a ponta. É **desligado por padrão**: sem a variável, nada muda.

**Como ligar:** defina `LAB_MODO_DEMO=true` nas variáveis do serviço (Cloud Run) e publique de novo. Só o texto `true` liga.

**Regras de segurança:**

- Só vale **sem** `LAB_IA_URL`. Com a IA real configurada, ela sempre vence e a variável é ignorada, com um aviso no log. Produção nunca troca a IA de verdade por uma de exemplo.
- Não precisa de `LAB_IA_TOKEN`. A tolerância de rede é 3 s, a menos que `LAB_TOLERANCIA_TEMPO_S` esteja definida.

**O que a IA de exemplo faz:** cinco situações escritas à mão (`demonstracao/conteudo.ts`), de um supervisor numa operação de manutenção. Toda situação aparece com o prefixo "(Demonstração)", o painel mostra uma faixa de aviso, e o texto do resumo do resultado diz que é de demonstração. As notas, os níveis, os alertas e os indicadores são **calculados de verdade** pelo backend a partir das escolhas; só o conteúdo e a avaliação de cada escolha são de exemplo. Uma opção (situação 4, opção C) vale 10 e abre o alerta vermelho, para mostrar como ele aparece. O texto livre é ignorado e não vira contribuição. A IA não guarda estado na memória (o total de situações vai no identificador da sessão), então um teste continua certo se o Cloud Run reiniciar a instância.

**O que o servidor prepara ao subir** (`demonstracao/preparar.ts`, repetível e seguro entre instâncias, com um lock do PostgreSQL):

1. libera o molde "supervisor", se ainda não estava liberado (um tempo já definido pelo negócio é respeitado; senão, 90 s por situação);
2. cria uma **operação fictícia só da demonstração** ("Demonstração do Leadership Lab", com empresa, cliente e unidade de nome parecido). O colaborador fictício precisa de uma operação, e colocá-lo numa operação real o poria nas listas e nas escalas de gente de verdade. Nenhuma operação existente é usada nem alterada. (O seed do repositório não cria operação nenhuma, e em produção elas existem de verdade.);
3. cria o cargo fictício "Supervisor (demonstração)", ligado a esse molde, e o colaborador fictício `DEMO-LAB` ("Participante de demonstração") nesse cargo e nessa operação, com a observação de que é fictício;
4. liga a conta `comum@myflux.local` a esse colaborador, tornando-a participante.

Nada disso acontece se a conta não existir ou não for do perfil COMUM, e uma conta que já está ligada a um colaborador é respeitada. O preparo nunca derruba o servidor.

**Como ver:** abra o endereço, clique em **Leadership Lab** no menu, siga a dica ("Ir para o login") e entre com `comum@myflux.local`. Aceite o termo e faça o teste.

**Para encerrar:** remova `LAB_MODO_DEMO` e publique de novo; o módulo desliga. Os registros ficam no banco e são fáceis de reconhecer: a operação "Demonstração do Leadership Lab" (com a empresa, o cliente e a unidade de mesmo tom), o colaborador `DEMO-LAB`, o cargo "Supervisor (demonstração)" e as sessões cujo `ia_sessao_id` começa com `demo.`. Esses testes são registros de verdade, em "aguardando validação"; vão aparecer na fila do curador quando a Etapa 5 existir. Como as chaves estrangeiras não têm cascata, apagar os testes exige remover as tabelas dependentes antes: o script de limpeza fica para quando o modo for encerrado.

## Cadastros do RH e configuração dos moldes (Etapa 5A)

O que antes só se fazia no banco (ligar o login ao colaborador, ligar o cargo ao molde, liberar o molde com o tempo) agora tem tela e API. A curadoria em si (fila de validação, alertas, contestações) é a Etapa 5B.

**Quem faz o quê** (a matriz em `packages/shared/src/leadership-lab-acesso.ts`, com testes):

| Quem                 | Faz                                                                          | Onde                                       |
| -------------------- | ---------------------------------------------------------------------------- | ------------------------------------------ |
| RH (curador)         | Cadastra, desativa e reativa participantes; cria e mantém as próprias turmas | Menu "Acompanhamento do Lab" (`/lab/rh`)   |
| ADMIN e DEV          | Define o tempo por situação, libera o molde e liga os cargos do RH a ele     | Menu "Configuração do Lab" (`/lab/config`) |
| Participante (COMUM) | Nada disto. Faz o teste                                                      | Menu "Leadership Lab" (`/lab`)             |

Cada perfil vê só a sua entrada no menu (no modo de teste sem login, todas, para o Lab ser encontrado).

**Rotas** (em `lab-cadastro-routes.ts`; mesmo prefixo, mesmo `Cache-Control: no-store`; corpos estritos, com os schemas de `packages/shared/src/leadership-lab-cadastro-api.ts`):

| Rota                                               | Faz                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| `GET /participantes`                               | Os participantes (ativos e desativados) das operações do escopo do RH    |
| `POST /participantes`                              | `{ userId, employeeId }`: liga um usuário comum a um colaborador         |
| `PATCH /participantes/:id`                         | `{ ativo }`: desativa ou reativa                                         |
| `GET /colaboradores-elegiveis?busca=`              | Quem ainda pode virar participante (no máximo 20)                        |
| `GET /usuarios-elegiveis?busca=`                   | Logins comuns ainda sem vínculo (no máximo 20)                           |
| `GET /turmas`, `POST /turmas`                      | As turmas do próprio curador; cria                                       |
| `GET /turmas/:id`, `PATCH /turmas/:id`             | O detalhe com os participantes; renomeia, encerra ou reabre              |
| `POST /turmas/:id/participantes`                   | `{ participanteId }`: inclui                                             |
| `DELETE /turmas/:id/participantes/:participanteId` | Tira da turma                                                            |
| `GET /config/moldes`                               | Os 3 moldes, os cargos ativos do RH e os testes em andamento             |
| `PUT /config/moldes/:nivel`                        | `{ tempoLimiteS, ativo, cargoIds }`: o estado desejado do molde, inteiro |

**Regras e garantias** (todas com teste de integração contra PostgreSQL real e verificação por mutação):

1. **Escopo do RH = o `UserScope` do sistema.** O RH só enxerga e cadastra colaboradores das operações do seu escopo (global, empresa, operação ou unidade), com as mesmas funções que o restante do sistema usa (`operationWhere` e `canAccessScope`). RH sem escopo nenhum não enxerga ninguém (falha fechado). A matriz ganhou o escopo `escopo-do-rh` para isto, e um teste obriga a listagem e a ação sobre um alvo a concordarem em todas as formas de escopo. Fora do escopo responde 404, igual a "não existe".
2. **Quem pode ser participante:** usuário ativo de perfil COMUM, sem vínculo; colaborador ativo (ativo, de licença ou de férias), de operação ativa, sem vínculo. Usuário que não existe, está inativo ou não é comum recebe a mesma recusa (a resposta não confirma que a conta existe). As buscas exigem 2 letras e devolvem no máximo 20: a lista inteira nunca sai.
3. **Nada é apagado.** Desativar o participante tira o acesso (o vínculo desativado vale como ausência de vínculo) e guarda o histórico; reativar devolve. Tirar da turma ou encerrar a turma tira do curador a visão dos resultados daquela pessoa, sem apagar nada.
4. **Cada curador só vê as próprias turmas.** A de outro curador, mesmo para o RH global, responde 404.
5. **O tempo por situação não muda com teste em andamento no molde** (o motor lê o tempo do molde a cada resposta). A troca e o início de um teste se serializam pela linha do molde (`SELECT ... FOR UPDATE`; o teste cobre a corrida com uma segunda conexão). Liberação e cargos podem mudar com teste em andamento: o teste em curso termina com o tempo que tinha.
6. **Liberar exige tempo** (o banco também recusa). Um cargo não pode estar em dois moldes: tentar pôr um cargo que já é de outro molde dá 409 com o nome dele, e nada muda.
7. **Toda mudança grava `AuditLog`** (entidades `LabParticipante`, `LabTurma`, `LabMolde`, com antes e depois) na mesma transação. Pedir o valor que já está não muda nada e não gera registro.
8. **A tela não sugere tempo algum.** O molde nasce sem tempo e desligado; o campo vem vazio e diz que a decisão é do negócio. O limite de 1 a 3600 s é só trava contra erro de digitação.

### Decisões que tomei e o negócio pode rever

1. **Quem cadastra participantes é o RH**, no escopo dele (a documentação diz que o vínculo é "cadastrado pelo RH"). O administrador não vê pessoas.
2. **Quem configura moldes, tempos e cargos é o administrador** (ADMIN e DEV): é "configuração de moldes e tempos" na matriz. Se o RH também deve ligar cargos a moldes, é uma ação a mais na matriz.
3. **Colaborador de licença ou de férias pode ser participante**; desligado, inativo ou com admissão agendada, não.
4. **O RH global (escopo global) enxerga todas as operações**, como no restante do sistema.
5. **Dois administradores salvando o mesmo molde ao mesmo tempo:** vale o último (é o estado desejado, inteiro). Para o piloto isso basta.
6. **Os temas e o número de situações do molde não se editam por aqui:** vêm do conteúdo do teste.

## Curadoria do RH e contestação do participante (Etapa 5B)

O RH da turma revisa os resultados, valida (com ajuste de nível, se for o caso), acompanha os alertas e decide contestações e contribuições. O participante contesta um ponto do próprio resultado e lê a resposta. Tudo restrito às **turmas ativas** do curador (as da 5A).

| Quem                 | Faz                                                                                 | Onde                                                                             |
| -------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| RH (curador)         | Revisa e valida resultados; encerra alertas; decide contestações e contribuições    | Menu "Acompanhamento do Lab": abas Revisão, Alertas, Contestações, Contribuições |
| Participante (COMUM) | Rever os próprios testes, ver o nível validado, contestar um ponto e ler a resposta | Painel ("Seus testes") e tela do resultado                                       |

**Rotas** (em `lab-curadoria-routes.ts`; mesmo prefixo, mesmo `Cache-Control: no-store`; entradas estritas, com os schemas de `packages/shared/src/leadership-lab-curadoria-api.ts`):

| Rota                                | Faz                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `GET /pendencias`                   | Quanto espera uma decisão (os números das abas)                                     |
| `GET /revisao?status=`              | A fila: resultados de testes **concluídos** dos participantes das turmas do curador |
| `GET /revisao/:resultadoId`         | A ficha: avaliação por situação, skills, alertas, contribuições e contestações      |
| `POST /resultados/:id/validacao`    | `{ ajustes?: [{ skillId, nivel }], justificativa? }`                                |
| `GET /alertas?status=`              | Alertas (inclusive de teste em andamento)                                           |
| `POST /alertas/:id/tratamento`      | `{ nota }`: encerra, com a nota da conversa de desenvolvimento                      |
| `GET /contribuicoes?status=`        | Ideias dos participantes                                                            |
| `POST /contribuicoes/:id/decisao`   | `{ decisao: "aprovada" \| "rejeitada" }`                                            |
| `GET /contestacoes?status=`         | Contestações dos participantes                                                      |
| `POST /contestacoes/:id/decisao`    | `{ decisao: "aceita" \| "rejeitada", nota }`                                        |
| `POST /resultados/:id/contestacoes` | Participante: `{ ponto, motivo }`, só do próprio resultado                          |
| `GET /resultados/:id/contestacoes`  | Participante: as próprias contestações, com a decisão e a nota (nunca quem decidiu) |

**Regras e garantias** (todas com teste de integração contra PostgreSQL real e verificação por mutação):

1. **Escopo = turmas ativas do curador** (a matriz `turma`). Fila, alertas, contribuições, contestações e pendências filtram por esse conjunto, e cada ação sobre um item confere o dono dele. Fora da turma, inexistente ou com id torto: o **mesmo 404**. Turma encerrada tira tudo da vista do curador.
2. **A ficha só existe com o teste concluído.** Alertas e contribuições nascem durante o teste (o alerta vermelho, "para o curador ser avisado na hora", como diz a migração 0017) e por isso aparecem na lista com a marca "em andamento", mas sem a avaliação. A ficha nunca traz o que o serviço de IA devolveu (`respostaIa`, modelo, tokens, id da sessão da IA): um teste confere as chaves exatas da resposta.
3. **Validar é definitivo e disputado com trava de linha** (`SELECT ... FOR UPDATE` no resultado): de dois curadores simultâneos, um valida e o outro recebe 409. Sem ajuste, o resultado vira "validado" e cada skill fica validada com o nível calculado; com ajuste, vira "ajustado": o nível novo vale, os demais ficam como calculados, e a justificativa é obrigatória (422 sem ela; ajuste igual ao calculado, de skill que não é do resultado ou repetido também é 422). Nada muda se algo falha.
4. **Encerrar alerta, decidir contribuição e decidir contestação** usam atualização condicional (`updateMany ... WHERE status = ...`): um só vence, o outro recebe 409, e não se desfaz. Encerrar alerta e decidir contestação **exigem a nota** (o banco também exige, no alerta).
5. **Auditoria** (`AuditLog`, na mesma transação): validação (`APPROVE`, com a justificativa no campo próprio e os ajustes de/para), alerta (`UPDATE`), contribuição e contestação (`APPROVE`/`REJECT`) e a criação da contestação (`CREATE`, com o perfil COMUM). O texto livre do participante e as notas **não são duplicados** na auditoria.
6. **O participante só contesta e lê o que é dele.** Resultado alheio, inexistente ou com id torto: o mesmo 404. A resposta dele traz decisão, data e nota, **nunca o nome de quem decidiu**. A justificativa do ajuste fica com o RH.
7. **O nível validado chega ao participante**: o resultado dele traz `nivelValidado` por skill (a tela mostra o nível do RH e diz qual era o calculado), e o painel já usava o validado. A tela "Seus testes", no painel, é o caminho de volta a cada resultado (antes só se via o resultado logo depois do teste).

### Decisões que tomei e o negócio pode rever

1. **Decidir uma contestação não altera o resultado sozinho.** "Aceita" registra a decisão e a nota. O ajuste de nível é feito na validação, e só enquanto o resultado aguarda validação. Com o resultado já validado, a decisão fica registrada e o resultado não muda (a tela do curador diz isso). Alternativa a decidir: permitir um segundo ajuste, com justificativa, quando a contestação for aceita.
2. **Uma validação não se refaz.** Corrigir um erro do curador hoje exige intervenção no banco.
3. **A nota da decisão de uma contestação é obrigatória**, aceita ou rejeitada, para o participante entender o que foi decidido.
4. **O participante não vê a justificativa do ajuste**, só o nível validado e que houve ajuste.
5. **O curador vê alertas e contribuições de teste em andamento** (é a intenção original do alerta vermelho), mas só abre a avaliação depois que o teste termina.
6. **Os limites de texto** (nota e justificativa: 1000; ponto contestado: 200; motivo: 1000) são travas técnicas, não regra de negócio.
7. **Sem texto de orientação por alerta**: a tela diz só que alerta é pedagógico, não disciplinar (decisão em aberto, como no painel).
8. **Sem limite de contestações por resultado.** O participante pode abrir várias; a lista do curador tem teto de 200 itens.

### Para ver o Lab funcionando num ambiente

Sem SQL. Em ordem:

1. **Usuário:** criar o usuário de perfil COMUM (tela de Usuários).
2. **Molde:** entrar como ADMIN ou DEV, abrir "Configuração do Lab", definir o tempo por situação do molde (decisão do negócio), marcar "Teste liberado" e marcar os cargos que o usam. Salvar.
3. **Participante:** entrar como RH (com escopo sobre a operação do colaborador), abrir "Acompanhamento do Lab", "Cadastrar participante", buscar o colaborador e o usuário e confirmar.
4. **Turma:** na aba "Turmas", criar a turma e incluir o participante (é ela que dá ao RH a visão dos resultados).
5. **Teste:** o participante entra, aceita o termo e inicia.
6. **Curadoria:** o RH abre "Acompanhamento do Lab" (abre na aba Revisão), revisa a ficha, valida (ajustando níveis, se for o caso), encerra os alertas e decide as contribuições. O participante abre o resultado pelo painel ("Seus testes"), vê o nível validado e, se quiser, contesta; o RH responde na aba Contestações.
7. As variáveis `LAB_IA_URL`, `LAB_IA_TOKEN` e `LAB_TOLERANCIA_TEMPO_S` e, claro, o serviço de IA (Etapa 2), ou o modo demonstração (`LAB_MODO_DEMO`).

### Decisões do front que o negócio pode rever

1. **Termo de ciência com texto provisório.** O texto completo não existe (é do RH e do jurídico). A tela mostra só o que o sistema faz, que já está decidido (as escolhas e o tempo ficam registrados, a IA não recebe dado pessoal, o resultado só vira histórico oficial depois da validação do RH), e avisa que o termo completo ainda será definido. Quando existir, substitui o resumo e a versão (`labTermoVersaoAtual`) muda, o que pede novo aceite.
2. **Quadrante dos estilos** no arranjo clássico da Liderança Situacional: direção no eixo vertical, apoio no horizontal.
3. **Escolher e confirmar são dois passos**, para uma tecla ou um toque errados não enviarem uma resposta que não pode ser trocada.
4. **A tela não mostra "o que fazer" nos alertas** (decisão em aberto, veja o painel) nem a média da turma.

## Serviço de IA (Etapa 2)

`services/lab-ia/`, em Python (FastAPI + Gemini pela Vertex AI). Implementa o contrato acima: `POST /teste/sessoes`, `POST /teste/turnos` e `POST /agentes/guarda`, com `X-Servico-Token` igual a `TOKEN_SERVICO`.

**Como conduz o teste.** A instrução (`agente.py`, `VERSAO_INSTRUCAO`) segue o prompt do negócio: diagnóstico adaptativo, uma situação por vez, com quatro trilhas (A Pessoas e Liderança, B Processos e Produtividade, C Metas e Estratégia, D Treinamento e Competências). Se o gestor foi bem numa trilha, a próxima situação muda de trilha; se foi mal, aprofunda a mesma. O fechamento traz "Diagnóstico encontrado" no resumo e, nas sugestões, um microtreinamento de três passos e uma ferramenta.

**Gabarito na criação.** Cada situação nasce com a avaliação escondida das três opções (aderência, estilo, skills e justificativa). A `avaliacao_anterior` é montada desse gabarito, nunca de uma segunda chamada ao modelo: a nota de uma escolha não muda depois de ela ser feita.

**Regras do contrato em código** (`contrato.py`): escala 100/70/40/10, as três opções com notas diferentes, alerta vermelho só com 10, omissão com aderência 0, marco na situação 3, A/B/C em ordem, skills só do piloto e sem repetição, resultado sem números. O que dá para corrigir sem mudar o sentido é corrigido; o resto refaz a chamada (`LAB_IA_TENTATIVAS`, padrão 2) e, se não der, responde 502.

**Modelo.** `gemini-3.5-flash` (`LAB_IA_MODELO`) pelo endpoint `global` da Vertex AI (`GOOGLE_CLOUD_LOCATION=global`). Em novembro de 2026 nenhum modelo Gemini respondia em `southamerica-east1` para o projeto, e os 2.5 já não estavam disponíveis: o processamento pode ocorrer fora do Brasil (decisão do jurídico; a IA não recebe dado pessoal e a Guarda mascara o campo livre). Raciocínio `LOW` nas situações (`LAB_IA_RACIOCINIO`) e `MINIMAL` na Guarda: no teste real, abertura em ~8 s e cada turno entre 3 e 6 s, dentro dos 25 s do backend.

**Estado.** Firestore, banco `lab-ia` (`LAB_IA_FIRESTORE`), coleção `lab_ia_sessoes`: situações, gabaritos, escolhas e a resposta já dada de cada turno. O reenvio do mesmo turno devolve a mesma resposta. Nada identifica o participante.

**Teste local** (modelo falso; valida a mecânica, não o conteúdo): `python services/lab-ia/tests/simular.py saida.json`.

**Produção** (projeto `gestao-rh-escalas`, região `southamerica-east1`):

| Peça                      | Valor                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------- |
| Serviço do Cloud Run      | `lab-ia`, **sem acesso público**                                                        |
| Conta de serviço          | `lab-ia@gestao-rh-escalas.iam.gserviceaccount.com` (Usuário da Vertex AI, Firestore)    |
| Segredo                   | `LAB_IA_TOKEN` no Secret Manager: `TOKEN_SERVICO` no `lab-ia` e `LAB_IA_TOKEN` no site  |
| Quem pode chamar          | a conta de serviço do site, com o papel Invocador do Cloud Run no `lab-ia`              |
| Site (`rh-monitoramento`) | `LAB_IA_URL`, `LAB_IA_TOKEN`, `LAB_IA_AUTENTICACAO=cloud-run`, `LAB_TOLERANCIA_TEMPO_S` |

Publicar uma versão nova do serviço:

```
gcloud run deploy lab-ia --source services/lab-ia --region southamerica-east1 --project gestao-rh-escalas
```

## Pendências

- ID token do Cloud Run para o `ClienteIaHttp` (gancho `autorizacao`): depende de onde o RH roda.
- Rotas e tela da gestão (agregados, mínimo de 5 pessoas por recorte). As do administrador (configuração dos moldes), as do RH (cadastros, curadoria) e a contestação do participante já existem (Etapas 5A e 5B).
- Texto do termo de ciência, do RH e do jurídico (a tela mostra um resumo provisório).
- **Encerrar o modo demonstração** quando o serviço de IA real existir: remover `LAB_MODO_DEMO`, definir `LAB_IA_URL`, `LAB_IA_TOKEN` e `LAB_TOLERANCIA_TEMPO_S`, e escrever o script que limpa os testes da conta de demonstração (veja "Modo demonstração").
- **Encerrar o modo de teste sem login** antes de pôr dados reais de colaboradores no ambiente: construir o front com `VITE_MODO_TESTE_SEM_LOGIN=false`, e trocar ou desativar as contas de demonstração do seed (a senha está no repositório, que é público) (decisão E).
- Painel: média anônima da turma, cálculo da tendência e texto de orientação de cada alerta. Decisões de negócio em aberto (veja "Decisões do painel que o negócio pode rever").
- Alinhar o contrato com o serviço Python (Etapa 2): itens marcados como proposta acima. Dependem do `agent.py` e do prompt de desenvolvimento.
- Limite de testes por dia: decisão de negócio em aberto. Por ora é a variável `LAB_LIMITE_TESTES_DIA` do backend; se virar configuração editável, entra uma tabela.
- Desistir ou cancelar um teste em andamento: o status `cancelada` existe e é respeitado, mas nenhum fluxo o aciona ainda. Enquanto isso, um teste abandonado fica aberto e é retomado na volta do participante.
- Tempo limite por situação de cada molde: decisão de negócio em aberto. A tela "Configuração do Lab" já permite defini-lo, mas não sugere nenhum valor.
- Curadoria: o que uma contestação aceita deve mudar no resultado, e se uma validação pode ser refeita (veja "Decisões que tomei e o negócio pode rever" na curadoria).
- Se o RH também deve ligar cargos a moldes (hoje é do administrador), e se uma pessoa pode ser participante e curadora: veja "Decisões que tomei e o negócio pode rever" nos cadastros.
- Agregados com mínimo de 5 pessoas por recorte: a matriz já limita `lab_gestao` a agregados; o cálculo do recorte entra com o painel da gestão (versão 2).

## Simulador local (modo demonstração)

Com `LAB_MODO_DEMO=true` e sem `LAB_IA_URL`, o Lab roda uma **biblioteca local de simulações hospitalares**, sem IA e sem nenhum serviço externo.

- **Fluxo:** o participante descreve o problema ("Qual problema você está enfrentando na operação?"), `POST /simulador/classificar` propõe um tema (classificador determinístico por palavras-chave; o texto não é gravado nem logado), ele confirma ou escolhe da lista (`GET /simulador/temas`) e `POST /sessoes` recebe `{ categoriaId }`. A descrição não consome uma das 5 situações. Sem correspondência, a lista de temas é mostrada: nunca se inventa situação fora da biblioteca.
- **Conteúdo:** `apps/api/src/modules/leadership-lab/simulador/cenarios/` (12 temas, um cenário cada). Cada cenário é um grafo de 9 situações em 5 camadas (1 → 2 → 2 → 2 → 2); toda opção aponta para a camada seguinte, então todo caminho tem exatamente 5 decisões e os caminhos convergem. A situação 3 é o marco e recorda as duas primeiras escolhas do caminho real. A abertura muda por cargo; as demais situações são comuns aos três cargos.
- **Avaliação:** aderência, estilo, skills, linha vermelha e justificativa moram só nos dados do cenário (servidor). O contrato da IA e o motor não mudaram: o provedor local (`IaDemonstracao`) refaz o caminho lendo as escolhas gravadas (`LeitorDoPercurso`). Um provedor Gemini futuro substitui o provedor sem mexer no motor nem na tela.
- **Validação:** `validador.ts` roda em todos os cenários nos testes (destinos, ciclos, nós inalcançáveis, 3 opções, limites de palavras, coerência estilo × aderência, fontes conhecidas, ausência de parâmetro técnico) e os testes percorrem os 1.024 caminhos (A, B, C ou tempo esgotado) de cada tema pelo contrato da IA.
- **Tela:** avatar facilitador em SVG (falando, ouvindo, refletindo, feedback), personagem da cena, cartões de decisão, consequência animada (tudo desligado com `prefers-reduced-motion`) e, no resultado, o mapa de decisões em React Flow. A cena (`situacao.cena`) e a simulação (`resultado.simulacao`) vêm das rotas e nunca carregam avaliação.

**Limites e pendências:** o conteúdo é **demonstrativo**, de nível gerencial, sem intervalos, pressões, temperaturas nem procedimentos. As fontes (`simulador/fontes.ts`) são referências temáticas que **não puderam ser consultadas** (WHO, NHS, CDC, ANVISA, gov.br inacessíveis na sessão de desenvolvimento): a validação técnica e pedagógica é do negócio. As pontuações são atribuídas pelo autor, não derivadas. O mapa mostra as alternativas só com o texto da opção (o que elas causariam não é revelado).

## Exceção: o perfil DEV vê o módulo inteiro

Diferente de ADMIN (só administrador), o perfil **DEV** acumula todos os papéis do Lab: participante, curador, gestão e especialista (`papeisLab` em `packages/shared/src/leadership-lab-acesso.ts`). No escopo de dados, o DEV alcança todos os participantes e todas as turmas (não só as dele). Existe para testar e dar suporte; vale para toda conta DEV (no modo de teste sem login, todo visitante entra como DEV). Para fazer o teste, o DEV precisa estar ligado a um colaborador: no modo demonstração, `dev@myflux.local` é ligado a um colaborador fictício e recebe `lab_gestao` e `lab_especialista`. ADMIN, RH e COMUM seguem a matriz de papéis separados.

## Conversa com o facilitador (Fase 3)

`POST /api/v1/leadership-lab/sessoes/:id/conversa`, no motor (`MotorDoTeste.conversar`). O participante conversa sobre o **próprio resultado**, **só depois do teste** (antes: 409 `LAB_TESTE_EM_ANDAMENTO`), sem interferir na avaliação nem no cronômetro. Ação `conversa:enviar` da matriz: só o papel `participante`, escopo `proprios` (sessão alheia: 404 idêntico ao de inexistente).

- **Entrada** (`labConversaEntradaSchema`, estrita): `mensagem` (até 500 caracteres) e `historico` (até 6 mensagens, `participante` ou `facilitador`). **Saída**: `{ desfecho: "respondida" | "bloqueada", resposta }`.
- **Nada é guardado.** O navegador manda o histórico recente a cada mensagem; o servidor grava só metadados da chamada em `log_ia` (agente `facilitador`, migração `0018`, com `down.sql`). Teto de 30 mensagens por teste (conta as linhas do `log_ia`): 429 `LAB_CONVERSA_LIMITE`.
- **Guarda em tudo que é do participante**: a mensagem nova e as antigas do histórico passam pela Guarda (falha fechada). Mensagem nova bloqueada = `desfecho: "bloqueada"` com aviso fixo, e a IA nem é chamada; antiga bloqueada vira `[mensagem removida]`; mascarada segue só mascarada. As mensagens do `facilitador` no histórico vêm do navegador e valem como **dado, nunca instrução**.
- **O que a IA recebe** (`conversaIaRequestSchema`, lista fechada): molde, mensagem, histórico e o resultado que o participante já viu (resumo, ponto forte, a desenvolver, sugestões, nível que vale por skill e, por situação, texto, opções, escolha e justificativa). **Nunca**: nome, matrícula, e-mail, ids, aderência, tempos, nem a avaliação das opções que ele não escolheu.
- **Contrato com o serviço** (PROPOSTA, a alinhar com o `agent.py`): `POST /agentes/facilitador` com o corpo acima, resposta `{ resposta, uso }` (`uso.agente = "facilitador"`). Resposta fora do contrato = 502 `LAB_IA_RESPOSTA_INVALIDA`; serviço fora = 502 `LAB_IA_INDISPONIVEL`.
- **Implementações**: `ClienteIaHttp.conversar` (produção), `IaFalsa` (testes), `IaDemonstracao` (responde por regras, sem IA: `demonstracao/facilitador-demonstracao.ts`) e o agente real no serviço Python (`services/lab-ia`, rota `POST /agentes/facilitador`: Gemini com saída JSON, instrução `INSTRUCAO_FACILITADOR`, sem estado, sem guardar a conversa).
- **Proteções no agente**: o pedido é validado por um modelo Pydantic estrito que espelha `conversaIaRequestSchema` (campo extra, aderência, mensagem longa ou histórico acima de 6 = 422, sem chamar o modelo); mensagem e histórico vão ao modelo dentro de `<dado>...</dado>` e a instrução manda tratá-los como dado, nunca como ordem; a resposta é conferida (vazia, JSON ou acima de 2000 caracteres é refeita; duas falhas = 502) e a falha do próprio modelo vira 502 sem vazar o motivo.
- **Como testar o serviço** (sem Gemini, com modelo falso): `pip install -r services/lab-ia/requirements.txt` e `python services/lab-ia/tests/simular_facilitador.py`. Os arquivos de `services/lab-ia/tests/fixtures/` são lidos também por `ia-contrato.test.ts`: se o formato mudar de um lado, o teste do outro reprova. **Ainda não foi exercitado com o modelo real** (precisa das credenciais do Vertex AI): vale revisar a instrução com respostas de verdade antes de liberar.

## Inteligência artificial do Lab: agentes, base de conhecimento e personalização

Princípio que não muda: **a IA propõe; o backend valida, calcula e decide.** Nenhuma nota, nível ou "validado" nasce no modelo.

### Agentes e responsabilidades

| Agente                     | Papel                                                                                                                                             | O que decide / não decide                                                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agente_lab` (treinamento) | Cria e conduz as situações do teste, no nível do cargo. Recebe o enquadramento do cargo, a rubrica, o perfil resumido e as fontes recuperadas.    | Propõe texto, opções e `base` (competências, fontes usadas). O **serviço** define a dificuldade (situações 1–2 na base do participante, depois +1, teto 3) e a fundamentação; o **backend** calcula aderência, níveis e estilo. |
| `guarda`                   | Filtra todo texto livre do participante (comentário do teste, mensagem e histórico da conversa).                                                  | Falha fechada: sem a liberação dele, o texto não segue.                                                                                                                                                                         |
| `facilitador`              | Mentor individual. **Debriefing** (depois do teste, com o resultado que o participante já viu) e **aprendizagem** (fora do teste, sem resultado). | Explica, orienta, cita fontes recuperadas. Não revela avaliação das opções não escolhidas nem dá pista numa situação cronometrada.                                                                                              |
| `autor`, `analista`        | Reservados em `labAgentesIa`; **não implementados**.                                                                                              | —                                                                                                                                                                                                                               |

### Fluxo

1. `POST /sessoes` → o backend monta o `contexto` (cargo, rubrica, perfil resumido) e abre a sessão no serviço, que recupera fontes e gera a situação 1.
2. Cada resposta → o backend avalia e pede a próxima; guarda `rubrica_versao`, `dificuldade` na sessão e `base_pedagogica` + `fundamentacao` por situação.
3. Fim do teste → o resultado nasce `experimental` se alguma situação não tinha base validada. O RH vê o aviso na ficha; com `LAB_EXIGE_BASE_VALIDADA=true` ele **não pode** ser validado como oficial (409 `LAB_RESULTADO_EXPERIMENTAL`).
4. Facilitador: `POST /sessoes/:id/conversa` (debriefing) e `POST /aprendizagem/conversa` (aprendizagem). Esta recusa com 409 `LAB_APRENDIZAGEM_BLOQUEADA` enquanto há teste em andamento, tem teto por participante por hora (`LAB_LIMITE_CONVERSAS_HORA`, padrão 30, 429) e passa pela Guarda como a outra.

### Personalização (`contexto`, `contextoPedagogicoIaSchema`)

- **Por cargo** (`packages/shared/src/leadership-lab-pedagogia.ts`, `labEnquadramentoPorMolde`): responsabilidades, competências em foco, profundidade técnica por skill (`nocao` | `aplicacao` | `dominio`) e `limiteTecnico`. Encarregado, supervisor e coordenador diferem (ex.: coordenador tem NR/POP e gestão de OS em `nocao`: cobra acompanhar e decidir, não executar). Esse enquadramento nunca é inferido pelo modelo.
- **Por histórico** (`personalizacao/perfil-resumido.ts`): só o resumo por skill (nível que vale, tendência, nº de testes, se provisório, escolhas fracas e se é recorrente), no máximo 5 skills. Nunca o histórico completo, texto de resposta, tempos, nome ou id. A consulta é sempre filtrada pelo id do participante (teste de isolamento) e, se falhar, o teste segue sem personalização.
- **Rubrica versionada** (`labRubrica`, versão `2026-11-1`, `validada: false`): quatro níveis (100/70/40/10) e o que observar por competência. Enquanto não for validada pelo RH, toda situação é `experimental`.

### Base de conhecimento (RAG) — `services/lab-ia/conhecimento`

- Fichas JSON em `fichas/`, uma por fonte, validadas por `ficha.py`: título, instituição, tipo (`legislacao`, `norma_tecnica`, `recomendacao`, `material_educacional`), competências, cargos, assunto, **pontos-chave curtos** (≤ 6, ≤ 280 caracteres cada: limite de direito autoral; nunca o documento) e `url`.
- Busca lexical (BM25, sem acento e sem stopwords), com filtro por cargo/tipo, reforço de legislação e de fontes validadas e piso de relevância; até 5 trechos (padrão 3). Falha de carregamento = base vazia = situações experimentais (o teste não para).
- `conteudo_extraido=false` = **ponteiro de estudo**: o facilitador pode indicar a norma, mas **não pode afirmar o que ela exige** (a instrução proíbe e o prompt marca `situacao="ponteiro"`).
- Segurança: as fontes entram no prompt como `<fonte>` (dado, não instrução; `<` e `>` removidos), assim como a mensagem e o histórico do participante em `<dado>`. As citações devolvidas são **filtradas** pelas fontes realmente recuperadas; a `fundamentacao` é calculada pelo serviço a partir das fichas, não pelo modelo.

| Fonte                                                                            | Estado hoje                                                      |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| NR-01, 06, 10, 12, 13, 17, 32 (Ministério do Trabalho)                           | Ponteiro de estudo, não validada                                 |
| RDC 509/2021 (ANVISA)                                                            | Ponteiro de estudo, não validada                                 |
| ENAP, SENAI (Gestão de Pessoas e de Equipes), Fundacentro (riscos psicossociais) | Ponteiro de estudo, não validada                                 |
| Sebrae (escuta ativa; capacitar equipes para decidir)                            | Pontos-chave a partir de resumos públicos de busca; não validada |

**Pendente:** o ambiente de desenvolvimento não alcançou os sites oficiais (gov.br, in.gov.br, sebrae, enap). Para uma ficha virar `validada` é preciso ler a fonte, preencher `pontos_chave`, `url` e `verificado_em` e marcar `conteudo_extraido` e `validada` (a ficha recusa `validada` sem os três).

### Controle, custo e privacidade

- Nada pessoal vai ao modelo (lista fechada de campos; teste de contrato recusa nome, e-mail, matrícula, ids, nota, tempos). Conversa não é guardada; `log_ia` guarda só agente, versão da instrução, modelo, tokens, latência, sucesso e código de erro.
- Custo: contexto resumido em toda chamada (nunca o histórico inteiro), no máximo 3 fontes por chamada, histórico da conversa limitado a 6 mensagens, 30 mensagens por teste (debriefing) e por hora (aprendizagem).
- Sem Gemini ou sem base: o modo demonstração responde por regras (`IaDemonstracao`, `facilitador-demonstracao.ts`), sem citar fontes nem explicar normas; no serviço, base vazia ou falha na busca só tornam a situação experimental.

### Como testar

```bash
# serviço (Python): conhecimento, agentes com modelo falso, contrato
python -m pytest services/lab-ia/tests
python services/lab-ia/tests/simular.py /tmp/saida.json
python services/lab-ia/tests/simular_facilitador.py
# backend e front
pnpm --filter @my-flux/shared test
LAB_TEST_DATABASE_URL=... LAB_E2E=1 pnpm --filter @my-flux/api exec vitest run src/modules/leadership-lab --no-file-parallelism
pnpm --filter @my-flux/web test
```

Os arquivos de `services/lab-ia/tests/fixtures/` (`conversa-*`, `iniciar-pedido.json`) são lidos pelos dois lados: `iniciar-pedido.json` é igual ao que o construtor do backend gera, então mudar o formato de um lado reprova o teste do outro.
