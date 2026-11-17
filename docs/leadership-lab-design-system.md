# Leadership Lab — design system

Escopo: só o módulo do Lab. O resto do MY FLUX continua com `components/ui` e o `AppShell`.

- **Tokens**: `apps/web/src/features/leadership-lab/ui/tokens.css` (variáveis `--lab-*`, escopadas em `.lab`, a raiz do `LabShell`), mapeados em `apps/web/tailwind.config.ts` (`bg-lab-superficie`, `text-lab-tinta-2`, `rounded-lab-lg`, `shadow-lab-2`, `text-lab-h1`...). As cores usadas em SVG (Recharts) ficam em `ui/cores.ts`; `cores.test.ts` falha se divergirem do CSS.
- **Componentes**: `features/leadership-lab/ui/`. `Button`, `Badge`, `Input`, `Select`, `Table*`, `Modal`, `EmptyState`, `ErrorState`, `LoadingState` e `Skeleton` têm a mesma API dos de `components/ui` (migrar o resto do sistema é trocar o import).
- **Layout**: `features/leadership-lab/layout/` (`LabShell`, passado ao `App` pela prop `layout`; carregado sob demanda).
- **Movimento**: Motion for React (`motion`). Vocabulário em `ui/movimento.ts`. `MotionConfig reducedMotion="user"` no shell; quem anima números e preenchimentos usa `useAnimacaoReduzida()`. Nos testes, `src/test/setup.ts` desliga as animações. Sem GSAP: nenhuma animação pediu.
- **Avatar 3D**: `componentes/avatar-facilitador-3d.tsx` (three.js + @react-three/fiber, carregado sob demanda). O mascote (`componentes/facilitador.webp`, recorte com transparência) num plano em perspectiva que acompanha o ponteiro; movimento por estado em `avatar-poses.ts`. Sem WebGL, falha de contexto ou jsdom, cai no avatar 2D; com "reduzir movimento", pose estática.
- **Notificações**: `useNotificar()` (sem efeito fora do `NotificacoesProvider`, que fica no shell).
- **Voz (Fase 4)**: `features/leadership-lab/voz/`. Síntese de fala do navegador (`sintese.ts`): botão "Ouvir a situação" no teste e leitura opcional das respostas do facilitador (desligada por padrão); o avatar fica em "falando" enquanto fala. Ditado (`ditado.ts`) só na conversa pós-resultado: opt-in com aviso, porque em vários navegadores o áudio é processado pelo fabricante; o MY FLUX não grava áudio e o texto ditado passa pela Guarda. Sem suporte do navegador, os controles não aparecem. Preferências em `localStorage` (opcional).
- **Primitivos de tela** (consolidados na evolução do design system): `MensagemDeErro` (erro de uma ação, `role="alert"`, variantes `caixa`/`texto`), `Marcacao` (checkbox/radio na cor de destaque), `classeDaSuperficie` (a superfície de cartão, usada por `Cartao`, `Estatistica`, `Table` e formulários) e `Button loading` para ações em andamento. Antes de criar um bloco na página, use estes.
- **Visão geral do RH** (`/lab/rh/visao-geral`, aba padrão do acompanhamento): pendências, resumo e distribuição da aderência e cadastro, todos derivados das consultas já existentes (`/pendencias`, `/revisao?status=todos`, `/participantes`, `/turmas`), no escopo do curador. Cálculos em `visao-geral-dados.ts`; quando a lista chega ao limite do servidor (200), a tela avisa que o resumo é parcial.

## Alinhamento ao redesenho do MY FLUX (fases 1 a 5)

O Lab usa a mesma paleta, as mesmas fontes e a mesma linguagem do resto do sistema:

- **Tokens:** `--lab-*` (tokens.css) só usam canais da paleta `--mf-*` (styles.css), mais cinzas de apoio e uma mistura de esmeralda 800 com tinta para o hover. `ui/tokens-paleta.test.ts` confere; `cores.ts` espelha os tokens.
- **Fontes:** Inter no corpo, Bricolage Grotesque em títulos e números grandes, JetBrains Mono em matrículas e códigos.
- **Shell:** fundo ambiente (parado durante o teste cronometrado), dock de navegação no celular (some no teste), avisos acima do dock, assistente que se recolhe com janela ou menu aberto.
- **Componentes:** foco azul de 3 px; campos com rótulo flutuante e erro fora do rótulo; interruptor em "Teste liberado"; KPIs com luz que segue o mouse; linhas de tabela com reflexo; avatar com anel nas listas de participantes; faísca quando o curador decide (validar, tratar alerta, decidir contribuição ou contestação); alvos de 44 px no toque.
- **Fora do escopo:** o teste cronometrado mantém o visual calmo de propósito (sem dock, sem fundo animado).
