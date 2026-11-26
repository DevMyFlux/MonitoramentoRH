# Acessos: quem pode o quê

Resumo do que o sistema decide por perfil e onde isso mora no código. Quem barra é **sempre a API**; a
interface só esconde o que o servidor já nega. Complementa `permissions.md` (hierarquia e escopos das
operações) e `modulos-ocultos.md`.

## Perfis e contas

Perfis: `DEV`, `ADMIN`, `RH`, `COMUM`. Toda conta nova tem **cargo, nível de governança e área**
(obrigatórios na API; contas antigas ficam com selo de "cadastro incompleto").

| Ação | DEV | ADMIN | RH | COMUM |
| --- | --- | --- | --- | --- |
| Criar / editar / desativar / remover conta de... | qualquer perfil | RH, COMUM | COMUM | ninguém |
| Alterar o próprio perfil, desativar-se ou remover-se | não | não | não | não |
| Rebaixar, desativar ou remover o **último DEV** ativo | recusado (409) | recusado | recusado | recusado |
| Áreas: ler / editar | ler e editar | ler e editar | ler | não |

A regra mora em `packages/shared/src/acessos.ts` (`can` e `decidirAcesso`), usada pela API e pela web.
A negação vira o código HTTP certo: `perfil` e `proprio` → 403; recurso alheio, módulo oculto ou
desconhecido → 404 igual a "não existe"; último DEV → 409; alvo incoerente → 400.

## Menu

O COMUM só tem o **Leadership Lab**. `/colaboradores`, `/escalas` e as rotas antigas de Treinamentos o
levam para o Lab. RH, ADMIN e DEV veem o Acompanhamento do Lab; ADMIN e DEV, a Configuração do Lab;
RH, ADMIN e DEV, a Configuração de treinamentos (RH só lê). Módulos ocultos (QLP, Recrutamento) não
existem para ninguém: 404 total.

## Leadership Lab

| Ação | COMUM | RH | ADMIN | DEV |
| --- | --- | --- | --- | --- |
| Fazer o próprio teste | sim (origem `participante`) | sim (`interno`) | sim (`interno`) | sim (`interno`) |
| Ler resultado | o próprio | das pessoas das turmas ativas dele | de participantes, leitura | todos |
| Validar resultado | não | sim (turmas dele; nunca o próprio) | não | sim |
| Contestar | o próprio resultado | não | não | não |
| Analisar e decidir contestação | não | turmas dele | todas | todas |
| Acompanhamento e exportação CSV | não (403) | turmas ativas dele | tudo | tudo |
| Cenários, regras de público e quantidades | não (404) | ler | editar e aprovar | editar e aprovar |

- **Teste interno** (feito por quem não é COMUM) nunca entra em média, funil nem comparação com o
  grupo; fica à parte.
- Fora do alcance, a API responde 404 igual a "não existe" (o RH, para quem não é da turma dele).
- A matriz do módulo está em `packages/shared/src/leadership-lab-acesso.ts` (ações `teste:*`,
  `contestacao:*`, `acompanhamento:*` etc.) e é aplicada em cada rota.
- Detalhes: `leadership-lab-teste-por-cenarios.md`.

## Módulo antigo de Treinamentos (`/api/v1/treinamentos`)

Os cenários agora são jogados dentro do teste do Lab (`/leadership-lab/teste`). A API de
Treinamentos continua para autoria, importação, aprovação, regras e quantidades (RH lê; ADMIN e DEV
editam), mas **está fechada ao COMUM**: qualquer rota responde 404 (sem login, 401). A tela
`/treinamentos/rh` foi removida; `/treinamentos/rh` redireciona para `/lab/rh/acompanhamento`.

## Assistente de IA

Equipe (DEV, ADMIN, RH): sem teto de mensagens e com consulta a dados de pessoas (conferida no
servidor). COMUM: só fala do Leadership Lab e dos próprios resultados, com teto por hora; qualquer
outro assunto, módulo ou pessoa recebe recusa e nenhum dado fora do escopo entra no contexto
(`politicaDoAssistente`).
