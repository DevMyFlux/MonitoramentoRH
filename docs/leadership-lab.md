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

## Cálculos

`packages/shared/src/leadership-lab-calculos.ts`. Funções puras, sem banco nem relógio: a IA propõe a aderência de cada escolha e **todos os indicadores são calculados aqui**. Valores gravados e exibidos saem com 2 casas; o nível usa a média sem arredondar.

| Função                     | O que faz                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `calcularResultado`        | Fecha o teste: aderência geral, agilidade, nível por skill, estilo, flexibilidade, alertas vermelhos |
| `medirResposta`            | Tempo medido no servidor, descontada a tolerância de rede (`LAB_TOLERANCIA_TEMPO_S`); diz se esgotou |
| `agilidadeDoTurno`         | `max(0; 1 − tempo ÷ limite) × 100`; tempo esgotado conta 0                                           |
| `nivelDaMedia`             | 90+ = 5, 70–89 = 4, 50–69 = 3, 25–49 = 2, abaixo de 25 = 1                                           |
| `classificarFlexibilidade` | alta a partir de 80%, média a partir de 40%, baixa abaixo disso                                      |
| `deveGerarAlertaAmarelo`   | Mesma skill com média abaixo de 50 nos dois últimos testes                                           |
| `podeExibirTendencia`      | Tendência e tipo de perfil só depois de 3 testes                                                     |

A entrada é validada com as mesmas regras do banco (escala de aderência; aderência 0 só com tempo esgotado). Entrada incoerente lança `LabCalculoError`.

### Onde a documentação deixa lacunas

Cada leitura abaixo está marcada com `INTERPRETAÇÃO` no código. São decisões de negócio para confirmar:

1. **Faixas de nível.** "70 a 89" é lido como o intervalo contínuo [70, 90), porque a média não é inteira (89,5 é nível 4).
2. **"Escolhas que envolveram a equipe"** = situações respondidas em que `estilo` não é nulo. Tempo esgotado é omissão, não decisão, e fica fora de estilo e flexibilidade.
3. **Empate no estilo mais frequente.** Não se escolhe um em silêncio: `estiloPredominante` fica nulo e os empatados vão em `estilosEmpatados`. Com 5 situações o empate é comum; falta definir o desempate.
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

Cada ação da matriz diz quais papéis a executam e **que dados cada um alcança** (`proprios`, `turma`, `agregados`, `configuracao`). Testes verificam a estrutura: nenhuma ação dá dado de pessoa a gestão, administrador ou especialista, e a tabela de resultados esperados cobre todas as ações.

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

## Pendências

- Limite de testes por dia: decisão de negócio em aberto. Por ora é a variável `LAB_LIMITE_TESTES_DIA` do backend; se virar configuração editável, entra uma tabela na Etapa 3.
- Política de falha da IA no meio de um teste (retomar, cancelar): Etapa 3. O status `cancelada` já existe.
- Tempo limite por situação de cada molde: decisão de negócio em aberto.
- Curador e escopo do RH (`UserScope`): ao montar turmas (Etapa 5), decidir se o RH só pode incluir colaboradores das operações do seu escopo. A matriz hoje não olha o escopo.
- Agregados com mínimo de 5 pessoas por recorte: a matriz já limita `lab_gestao` a agregados; o cálculo do recorte entra com o painel da gestão (versão 2).
