# MyFlux — manual do sistema

**Referência:** código disponível em 16/09/2026 · versão do projeto: `0.0.0` · ambiente de desenvolvimento.

Este documento descreve a implementação atual, como iniciar o ambiente demonstrativo e como testar o fluxo. Recursos parciais e melhorias previstas estão identificados ao final. Não representa uma homologação para produção.

## 1. Para que serve

O MyFlux integra a estrutura dos contratos com a gestão de pessoas e a montagem de escalas. O objetivo é acompanhar quantas pessoas uma operação precisa, quais posições estão abertas, quem será contratado e quem está apto e disponível para trabalhar.

O fluxo principal é:

```text
Empresa / cliente / unidade / contrato / operação
  → QLP aprovado
  → posições
  → recrutamento e admissão
  → colaborador e requisitos de aptidão
  → disponibilidade e eventos
  → escala mensal
  → revisão, aprovação e publicação
```

- **Operação:** contexto no qual são planejadas as necessidades de pessoal e as escalas.
- **QLP:** quadro de lotação previsto; registra a quantidade necessária por função, turno e equipe, com vigência e versão.
- **Posição:** uma necessidade individual de pessoal originada de um QLP operacional aprovado.
- **Colaborador:** pessoa cadastrada na operação, com função, documentos e vínculos operacionais.
- **Aptidão:** resultado da verificação dos requisitos cadastrados para a pessoa e a atividade.
- **IDM:** gestão de identidades e acessos; controla usuários, perfis e escopos.
- **Escopo:** empresas, unidades ou operações nas quais um usuário pode atuar.

## 2. Instalar e iniciar no Windows

### Requisitos

- Node.js 22 ou superior.
- pnpm; a versão indicada no projeto é `11.19.0`.
- Dependências instaladas com `pnpm install`.
- Portas locais livres: `55432` para PostgreSQL, `3334` para API e `5175` para frontend.

Os comandos abaixo usam PowerShell e o banco local incorporado ao projeto. Abra três terminais separados. Se o projeto for movido, ajuste apenas o caminho de `Set-Location`.

### Terminal 1 — banco

```powershell
Set-Location -LiteralPath 'C:\Users\ricar\OneDrive\Documentos\New project'
pnpm install
node scripts/local-db.mjs
```

Mantenha esse terminal aberto. Aguarde a mensagem de disponibilidade do PostgreSQL antes de executar o próximo passo. Nas próximas inicializações, não é necessário repetir `pnpm install` se as dependências não mudaram.

### Terminal 2 — preparação inicial e API

Com o banco em execução, prepare o esquema e os dados demonstrativos:

```powershell
Set-Location -LiteralPath 'C:\Users\ricar\OneDrive\Documentos\New project'
node scripts/run-local.mjs generate
node scripts/run-local.mjs migrate
$env:DATABASE_URL = 'postgresql://my_flux:my_flux_local@127.0.0.1:55432/my_flux'
node apps/api/node_modules/tsx/dist/cli.mjs apps/api/prisma/seed.ts
node scripts/run-local.mjs seed
node scripts/run-local.mjs api
```

O seed base cria os perfis e usuários; o demo seed cria a estrutura operacional. A variável `DATABASE_URL` acima é necessária para que o seed base use o mesmo banco dos scripts locais.

**Reexecutar o seed base redefine a senha das quatro contas demonstrativas e as reativa.** O demo seed também reaplica configurações demonstrativas. Não use esses comandos como rotina de abertura de um ambiente com dados reais.

Nas próximas inicializações, basta executar no terminal da API:

```powershell
Set-Location -LiteralPath 'C:\Users\ricar\OneDrive\Documentos\New project'
node scripts/run-local.mjs api
```

Execute novas migrações quando houver mudanças no esquema do projeto.

### Terminal 3 — frontend

```powershell
Set-Location -LiteralPath 'C:\Users\ricar\OneDrive\Documentos\New project'
node scripts/run-local.mjs web
```

### Endereços

- **Entrada do sistema:** [http://localhost:5175/login](http://localhost:5175/login).
- **Painel:** [http://localhost:5175/](http://localhost:5175/).
- **API:** `http://localhost:3334/api/v1`.
- **Verificação HTTP da API:** [http://localhost:3334/api/v1/health](http://localhost:3334/api/v1/health). Uma resposta desse endpoint, isoladamente, não comprova todo o fluxo nem a conexão com o banco.

Para abrir pelo CMD:

```bat
start "" "http://localhost:5175/login"
```

Este manual usa os scripts locais. O comando alternativo `pnpm dev` usa a configuração padrão de desenvolvimento, com outras portas; não misture os dois modos durante o teste.

### Encerrar e preservar os dados

Use `Ctrl+C` nos terminais do frontend e da API e depois no banco. Os dados persistem em `.local/postgres`; fechar o navegador não apaga cadastros. Não exclua essa pasta para reiniciar o sistema. Para cópias consistentes do banco, use ferramentas de backup do PostgreSQL.

## 3. Login e contas demonstrativas

Todas as contas abaixo usam a senha **`ChangeMe!2026`** após a execução do seed base:

- **DEV:** `dev@myflux.local` — acesso técnico máximo, global.
- **ADMIN:** `admin@myflux.local` — administração no escopo demonstrativo.
- **RH:** `rh@myflux.local` — gestão de pessoas no escopo demonstrativo.
- **COMUM:** `comum@myflux.local` — acesso básico no escopo demonstrativo.

Use DEV para o primeiro teste completo. Essas credenciais são públicas no projeto e destinam-se ao ambiente local de demonstração.

Sem sessão válida, as páginas internas encaminham para o login. Uma sessão salva ainda válida pode permitir retornar ao painel sem digitar a senha novamente. Portanto, o comportamento atual não exige um novo login a cada abertura do navegador. Para testar outra conta, clique em **Sair** e entre novamente.

## 4. Perfis e IDM

A hierarquia é `DEV > ADMIN > RH > COMUM`. O perfil define as ações permitidas; o escopo limita onde elas podem acontecer. A API aplica as verificações de acesso.

- **DEV:** acesso global, criação dos demais perfis e ações técnicas especiais nos fluxos que possuem essa opção. A criação de um novo DEV exige escopo global.
- **ADMIN:** administra cadastros e processos autorizados no seu escopo; aprova QLP e escalas e publica escalas.
- **RH:** atua nos recursos de pessoas e pode enviar escalas para revisão, conforme as regras de cada rota.
- **COMUM:** consulta recursos autorizados no seu escopo; não possui acesso à gestão de usuários.

Na tela **Usuários**, estão disponíveis criação de conta, escolha de perfil e escopo, bloqueio e reativação. Há proteção no servidor contra bloquear o último DEV ativo.

Para usuários que não são DEV, a gestão de contas exige perfil inferior e vínculo de criação: a listagem atual de ADMIN/RH considera contas criadas pelo próprio usuário. Não corresponde a um diretório completo de todas as pessoas do mesmo escopo.

**Limites atuais:** não há editor completo de permissões, troca de perfil, escopo ou senha na tela de usuários. A delegação de escopo pela tela ainda precisa de ajustes: a seleção apenas de operação pode não atender à validação de um escopo que também contém empresa e unidade. Teste os perfis inferiores separadamente; sucesso como DEV não comprova os acessos de ADMIN/RH.

## 5. Dados criados pelo demo seed

Em uma base preparada com os dois seeds, estão previstos:

- Empresa Demonstrativa, Cliente Demonstrativo e Unidade Central (`UC-01`).
- Contrato Operacional 2026 (`CTR-2026`) e Operação Demonstrativa (`OP-01`).
- Escopos da operação demonstrativa para ADMIN, RH e COMUM.
- Funções **Técnico operacional** (`TEC-01`) e **Auxiliar operacional** (`AUX-01`).
- Turno `DIURNO`, fuso `America/Sao_Paulo`, início às 7h, duração de 8 horas, descanso mínimo de 11 horas, de segunda a sexta-feira.
- QLP operacional versão 1 aprovado, vigente a partir de 01/01/2026, com duas posições de técnico e uma de auxiliar. A criação das posições depende da existência prévia de posições ativas para essa versão.
- Exigência de ASO para técnico, com antecedência de aviso de 30 dias.
- Colaborador **Pessoa Demonstrativa**, matrícula `DEMO-001`, técnico, turno diurno, equipe A, admitido em 02/01/2025.
- Registro de ASO demonstrativo emitido em 01/01/2026 e válido até 31/12/2026.

O identificador da operação demonstrativa é `55555555-5555-4555-8555-555555555555`, útil quando um formulário pedir o ID.

O seed não entrega um recrutamento completo nem uma escala publicada. Esses registros são criados durante os testes. Se já houve uso do ambiente, as quantidades vistas na tela podem ser maiores. A validade do documento demonstrativo também limita testes em meses posteriores a dezembro de 2026.

## 6. Funcionalidades por área

### Cadastros de organização

Empresas, clientes, unidades, contratos, operações, serviços, obrigações e funções estruturam o negócio. As telas oferecem listagem e formulários de criação e edição, além de arquivamento nos cadastros operacionais implementados.

Para trocar informações de cliente ou contrato, abra o cadastro correspondente, escolha o registro e use **Editar**. Altere os campos ou vínculos disponíveis e salve. Ao relacionar registros, mantenha coerência entre empresa, unidade, contrato e operação.

Arquivar retira o registro das listagens ativas. Não há uma ação geral de restauração na interface. Também não há um assistente de transferência que reorganize automaticamente todos os vínculos quando um cliente ou contrato muda.

### QLP e posições

O QLP reúne necessidades por função, turno e equipe. Sua versão passa por rascunho, revisão e aprovação. Aprovar um QLP operacional gera as posições correspondentes. A API bloqueia a criação de posição sem essa origem.

A cobertura permite comparar as necessidades com as ocupações. A implementação mantém versões aprovadas anteriores; aprovar outra versão não encerra automaticamente a anterior. Para gerar uma escala, o sistema busca a versão aprovada mais recente cuja vigência cubra o mês inteiro.

### Recrutamento e admissão

A solicitação de recrutamento nasce vinculada a uma posição. Depois é cadastrado o candidato, que percorre as etapas de recrutamento, seleção, documentação, exame médico, admissão agendada e admissão concluída.

Na admissão, a API cria o colaborador, vincula a posição e registra histórico. Há controles contra solicitação aberta duplicada, atualização desatualizada e admissão em posição já ocupada.

**Atenção ao modo demonstrativo da tela:** o avanço atual marca documentação e liberação médica automaticamente e usa data de admissão fixa em 01/01/2026. Isso não representa conferência documental ou médica real. O registro de ASO do novo colaborador precisa ser cadastrado separadamente quando exigido.

### Colaboradores, documentos e competências

Esses cadastros descrevem as pessoas e suas qualificações. Requisitos por função e operação e a matriz de competências alimentam a avaliação de aptidão. Documentos ausentes ou vencidos podem impedir a alocação.

Um cadastro de documento representa seus dados e validade; não pressupõe que exista um processo completo de armazenamento e validação de anexos.

### Eventos e disponibilidade

Eventos associados ao colaborador representam situações que afetam a disponibilidade, como afastamentos. Eles entram no cálculo da escala. Depois de mudar eventos ou requisitos, revalide ou gere novamente a escala para atualizar o resultado.

### Escalas

A geração mensal considera QLP, posições, parâmetros do turno, documentos, competências, disponibilidade e descanso. O resultado contém métricas de necessidade, cobertura e pendências.

O fluxo é **rascunho → em revisão → aprovada → publicada**. RH pode enviar para revisão; ADMIN/DEV possuem ações de aprovação e publicação. Há ações técnicas de DEV com justificativa nos fluxos que as suportam.

Antes de publicar, confira a cobertura: o estado “publicada” não garante, sozinho, que todas as posições estejam cobertas. A tela atual apresenta métricas e mudanças de estado, mas ainda não oferece um calendário completo com edição visual das alocações.

### Auditoria, importações e demais recursos

- **Auditoria:** consulta de registros das ações instrumentadas, restrita a DEV/ADMIN. Não se deve assumir que toda ação possível já possui registro completo.
- **Importações:** a API possui preparação, validação, consulta de problemas e confirmação. Somente a importação de colaboradores possui confirmação implementada; QLP e escala ainda não têm efetivação. A tela exige dados técnicos e não oferece o fluxo completo de confirmação.
- **Parâmetros:** configuram regras como os turnos usados pelo gerador. O código do turno precisa corresponder ao usado nas posições.
- **Painel e relatórios:** apresentam dados consolidados dos recursos disponíveis; a existência do módulo não significa que todos os relatórios desejados estejam concluídos.
- **Avaliações:** há recursos na API, mas o acesso pela navegação principal ainda não está concluído.

## 7. Roteiro curto de teste completo

1. **Entrar:** abra `/login` e autentique como DEV. Confira os cadastros da Operação Demonstrativa.
2. **QLP:** abra `/qlp`. Para o primeiro teste, use o QLP demonstrativo aprovado. Para testar aprovação, crie uma versão com função, turno `DIURNO`, equipe e quantidade; envie para revisão e aprove. Use vigência que cubra todo o mês desejado, preferencialmente iniciando antes do primeiro dia desse mês.
3. **Posição:** confira a cobertura e identifique uma posição ainda desocupada. Posições são geradas pelo QLP aprovado.
4. **Recrutamento:** abra `/recrutamento`, crie uma solicitação para essa posição e cadastre um candidato fictício. Avance pelas etapas até admissão. Observe o atalho demonstrativo de documentos, exame e data descrito acima.
5. **Colaborador:** abra `/colaboradores` e confira a pessoa criada. Cadastre os requisitos necessários, incluindo ASO válido se a função exigir. Admissão não cria automaticamente esse documento.
6. **Escala:** abra `/escalas`, selecione a operação e um mês integralmente coberto pelo QLP. Para os dados originais do demo, outubro de 2026 é uma referência útil. Gere e confira cobertura e pendências.
7. **Publicação:** envie para revisão, aprove e publique. Falta de colaboradores aptos pode manter cobertura parcial; não trate isso como preenchimento automático de vagas.
8. **Permissões:** saia e teste ADMIN, RH e COMUM. Verifique as ações permitidas e os bloqueios, especialmente em `/usuarios`. COMUM deve receber bloqueio na gestão de usuários.

Para testar indisponibilidade, registre um evento para o colaborador em parte do mês e gere ou revalide a escala. Para testar aptidão, use um documento vencido em um colaborador fictício e confira as razões de impedimento. Preserve o cadastro demonstrativo original se quiser reutilizar a referência.

## 8. Organização técnica

- `apps/web`: frontend React com Vite, páginas e cliente HTTP.
- `apps/api`: API Fastify, regras de negócio, autenticação e autorização.
- `apps/api/prisma`: modelo Prisma, migrações e seeds.
- `packages`: configurações, tipos e validações compartilhadas.
- `scripts/local-db.mjs`: inicialização do PostgreSQL local persistente.
- `scripts/run-local.mjs`: execução dos serviços e comandos de banco com as portas deste manual.

As rotas da API usam o prefixo `/api/v1`. Alguns pontos de entrada são `/auth/login`, `/auth/me`, `/users`, `/qlp/versions`, `/positions`, `/recruitment/candidates` e `/schedules/generate`. Esses caminhos de API não são as URLs das páginas do navegador.

Comandos de verificação disponíveis, executados na raiz:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

A elaboração deste manual foi baseada na leitura do código; não constitui uma nova execução dessa suíte. Em ambientes Windows com bloqueio de criação de processos, falhas `spawn EPERM` precisam ser resolvidas para concluir testes e build.

Documentos técnicos complementares: [arquitetura](../ARCHITECTURE.md), [permissões](permissions.md) e [decisões de domínio](domain-decisions.md). Em divergências, confira a implementação das rotas: alguns documentos técnicos descrevem a intenção do projeto.

## 9. Problemas comuns

- **Página não abre:** confira se o frontend continua executando e se está usando `localhost:5175`.
- **“Failed to fetch”:** confira a API na porta `3334`, o terminal dela e a origem `http://localhost:5175`. Evite alternar para `127.0.0.1` no navegador durante o teste de origem HTTP.
- **Login falha:** confira o banco e a execução dos dois seeds na mesma `DATABASE_URL`. Uma conta bloqueada não entra.
- **Volta ao login:** a sessão pode ter expirado ou a validação da sessão pode ter falhado por indisponibilidade da API. A renovação de sessão ainda precisa de ajustes.
- **Ação negada:** verifique perfil e escopo. Botão visível não garante autorização na API.
- **Erro ao editar ou arquivar:** algumas telas genéricas mostram ações para as quais o módulo ainda não possui rota correspondente. Registre qual cadastro e ação falharam.
- **Posição não aparece:** confirme que o QLP é operacional e foi aprovado.
- **Admissão recusada:** confira se a posição está ocupada, se há solicitação já aberta e se os dados necessários estão presentes. Atualize a lista se outra alteração ocorreu durante a edição.
- **Escala sem cobertura:** confira vigência do QLP, turno parametrizado, posições ativas, colaboradores aptos, documentos, competências e eventos.
- **Dados diferentes do manual:** testes anteriores permanecem no banco. Não reexecute seeds esperando apagar todo o histórico.

## 10. Limitações e evolução prevista

O fluxo central possui implementação, mas o sistema ainda está em desenvolvimento. Pontos que exigem conclusão ou homologação:

1. **Sessão e recuperação de acesso:** existem duas camadas de cliente HTTP com armazenamento de tokens diferente. Sair limpa a sessão no navegador, mas a tela não chama a rota de revogação do refresh token. Recuperação e convite têm recursos de API, sem fluxo público completo na navegação nem envio de e-mail implementado.
2. **Cadastros:** alinhar os botões das telas às rotas de cada módulo, completar edição/arquivamento onde faltam e validar melhor mudanças nos vínculos organizacionais.
3. **IDM:** concluir manutenção de perfil e escopo e ajustar a delegação por ADMIN/RH na interface.
4. **Admissão:** substituir os valores automáticos demonstrativos por conferência explícita de documentos, exame, matrícula e data.
5. **QLP:** definir a substituição de versões aprovadas e evitar interpretações ambíguas de versões simultâneas.
6. **Escalas:** concluir visualização detalhada, edição e tratamento das pendências antes da publicação, conforme as regras finais do negócio.
7. **Importações e avaliações:** completar os fluxos acessíveis pelo navegador.
8. **Homologação:** testar o ciclo inteiro com cada perfil, incluindo recusas, concorrência, datas, documentos vencidos e cobertura insuficiente.

Esses itens são a evolução necessária identificada na leitura atual, não funcionalidades entregues por este documento. A criação deste manual não altera as regras, os usuários ou os dados do sistema.
