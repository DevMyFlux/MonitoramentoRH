// Rotas web dos módulos OCULTOS. Só entram no roteador se o módulo estiver "active" em
// packages/shared/src/modules.ts; oculto, a URL cai na página 404 padrão e o código da página nem é
// carregado (import dinâmico). Para religar: veja docs/modulos-ocultos.md.
import { MODULOS, type ModuloDef } from "@my-flux/shared";
import { lazy, Suspense } from "react";
import type { RouteObject } from "react-router-dom";
import { App } from "../App";

const QlpPage = lazy(() => import("./qlp/qlp-page").then((m) => ({ default: m.QlpPage })));
const RecruitmentPage = lazy(() =>
  import("./recrutamento/recruitment-page").then((m) => ({ default: m.RecruitmentPage }))
);

export function rotasOcultas(
  registro: Readonly<Record<string, ModuloDef>> = MODULOS
): RouteObject[] {
  const rotas: RouteObject[] = [];
  if (registro.qlp?.status === "active")
    rotas.push({
      path: "/qlp",
      element: (
        <App breadcrumbs={["MY FLUX", "QLP"]}>
          <Suspense fallback={null}>
            <QlpPage />
          </Suspense>
        </App>
      )
    });
  if (registro.recrutamento?.status === "active")
    rotas.push({
      path: "/recrutamento",
      element: (
        <App breadcrumbs={["MY FLUX", "Recrutamento"]}>
          <Suspense fallback={null}>
            <RecruitmentPage />
          </Suspense>
        </App>
      )
    });
  return rotas;
}
