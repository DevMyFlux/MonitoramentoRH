# Leadership Lab — design system

Escopo: só o módulo do Lab. O resto do MY FLUX continua com `components/ui` e o `AppShell`.

- **Tokens**: `apps/web/src/features/leadership-lab/ui/tokens.css` (variáveis `--lab-*`, escopadas em `.lab`, a raiz do `LabShell`), mapeados em `apps/web/tailwind.config.ts` (`bg-lab-superficie`, `text-lab-tinta-2`, `rounded-lab-lg`, `shadow-lab-2`, `text-lab-h1`...). As cores usadas em SVG (Recharts) ficam em `ui/cores.ts`; `cores.test.ts` falha se divergirem do CSS.
- **Componentes**: `features/leadership-lab/ui/`. `Button`, `Badge`, `Input`, `Select`, `Table*`, `Modal`, `EmptyState`, `ErrorState`, `LoadingState` e `Skeleton` têm a mesma API dos de `components/ui` (migrar o resto do sistema é trocar o import).
- **Layout**: `features/leadership-lab/layout/` (`LabShell`, passado ao `App` pela prop `layout`; carregado sob demanda).
- **Movimento**: Motion for React (`motion`). Vocabulário em `ui/movimento.ts`. `MotionConfig reducedMotion="user"` no shell; quem anima números e preenchimentos usa `useAnimacaoReduzida()`. Nos testes, `src/test/setup.ts` desliga as animações. Sem GSAP: nenhuma animação pediu.
- **Avatar 3D**: `componentes/avatar-facilitador-3d.tsx` (three.js + @react-three/fiber, carregado sob demanda). O mascote (`componentes/facilitador.webp`, recorte com transparência) num plano em perspectiva que acompanha o ponteiro; movimento por estado em `avatar-poses.ts`. Sem WebGL, falha de contexto ou jsdom, cai no avatar 2D; com "reduzir movimento", pose estática.
- **Notificações**: `useNotificar()` (sem efeito fora do `NotificacoesProvider`, que fica no shell).
