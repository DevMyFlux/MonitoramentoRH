# Decisões de domínio

- Dados da operação piloto não fazem parte do domínio. O arquivo `demo-seed.ts` contém somente uma fixture demonstrativa.
- QLP operacional aprovado materializa posições. A criação de posição manual foi bloqueada para preservar a origem do headcount.
- Recrutamento exige posição aprovada; candidato selecionado e admissão futura não contam como efetivo atual.
- Admissão cria colaborador, alocação e histórico em uma transação. A matrícula é obrigatória para evitar duplicidade silenciosa.
- Aptidão combina requisitos documentais, competências, situação e disponibilidade e sempre retorna status com motivos.
- Regras de descanso, ciclos e turnos não são inferidas por lei. Elas vêm da configuração `OperationalParameter` homologada pela operação.
- Escala é gerada no servidor a partir de snapshot. Uma geração nova cria outra versão e mantém as anteriores.
- Datas persistidas são UTC; a conversão do horário operacional usa o timezone configurado no turno.
- Importações entram em staging. Apenas o commit, após validação e dentro de transação, cria colaboradores.
- `TODO_DOMAIN_DECISION`: definir aprovadores por unidade para overrides de escala e o catálogo final de regras de composição de equipe.
