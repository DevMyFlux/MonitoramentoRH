/* eslint-disable react-refresh/only-export-components */
import React, { lazy } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider, Link } from "react-router-dom";
import { App } from "./App";
import { LoginPage } from "./pages/login-page";
import { DashboardPage } from "./pages/dashboard-page";
import { ResourcePage } from "./pages/resource-page";
import { resources } from "./features/my-flux/resources";
import { QlpPage } from "./pages/qlp-page";
import { RecruitmentPage } from "./pages/recruitment-page";
import { MonthlySchedulePage } from "./pages/monthly-schedule-page";
import { UsersPage } from "./pages/users-page";
import { EmployeesPage } from "./pages/employees-page";
import { HomeRedirect } from "./pages/home-redirect";
import "./styles.css";

// Leadership Lab: páginas carregadas sob demanda (o painel traz a biblioteca de gráficos).
const LabPainelPage = lazy(() =>
  import("./pages/lab/lab-painel-page").then((m) => ({ default: m.LabPainelPage }))
);
const LabTestePage = lazy(() =>
  import("./pages/lab/lab-teste-page").then((m) => ({ default: m.LabTestePage }))
);
const LabResultadoPage = lazy(() =>
  import("./pages/lab/lab-resultado-page").then((m) => ({ default: m.LabResultadoPage }))
);
const LabAprendizagemPage = lazy(() =>
  import("./pages/lab/lab-aprendizagem-page").then((m) => ({ default: m.LabAprendizagemPage }))
);
const LabParticipantesPage = lazy(() =>
  import("./pages/lab/rh/lab-participantes-page").then((m) => ({ default: m.LabParticipantesPage }))
);
const LabTurmasPage = lazy(() =>
  import("./pages/lab/rh/lab-turmas-page").then((m) => ({ default: m.LabTurmasPage }))
);
const LabTurmaPage = lazy(() =>
  import("./pages/lab/rh/lab-turma-page").then((m) => ({ default: m.LabTurmaPage }))
);
const LabRevisaoPage = lazy(() =>
  import("./pages/lab/rh/lab-revisao-page").then((m) => ({ default: m.LabRevisaoPage }))
);
const LabFichaPage = lazy(() =>
  import("./pages/lab/rh/lab-ficha-page").then((m) => ({ default: m.LabFichaPage }))
);
const LabAlertasPage = lazy(() =>
  import("./pages/lab/rh/lab-alertas-page").then((m) => ({ default: m.LabAlertasPage }))
);
const LabContestacoesPage = lazy(() =>
  import("./pages/lab/rh/lab-contestacoes-page").then((m) => ({ default: m.LabContestacoesPage }))
);
const LabContribuicoesPage = lazy(() =>
  import("./pages/lab/rh/lab-contribuicoes-page").then((m) => ({ default: m.LabContribuicoesPage }))
);
const LabConfigPage = lazy(() =>
  import("./pages/lab/lab-config-page").then((m) => ({ default: m.LabConfigPage }))
);
// O layout do Lab (menu, topo e transições do design system do módulo) também é sob demanda: o
// Motion e os estilos dele não pesam nas outras áreas do sistema. A espera das páginas (Suspense)
// fica dentro dele.
const LabShell = lazy(() =>
  import("./features/leadership-lab/layout/lab-shell").then((m) => ({ default: m.LabShell }))
);
function PaginaDoLab({
  breadcrumbs,
  children
}: {
  breadcrumbs: string[];
  children: React.ReactNode;
}) {
  return (
    <App layout={LabShell} breadcrumbs={["MY FLUX", "Leadership Lab", ...breadcrumbs]}>
      {children}
    </App>
  );
}
const paths: Record<string, string> = {
  qlp: "QLP",
  recrutamento: "Recrutamento",
  escalas: "Escalas",
  avaliacoes: "Avaliações",
  auditoria: "Auditoria",
  importacoes: "Importações",
  parametros: "Parâmetros",
  usuarios: "Usuários"
};
function Wrapped({ resourceKey }: { resourceKey: string }) {
  return (
    <App
      breadcrumbs={["MY FLUX", paths[resourceKey] ?? resources[resourceKey]?.title ?? resourceKey]}
    >
      <ResourcePage resourceKey={resourceKey} />
    </App>
  );
}
const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  // Dashboard is hidden from the interface for now: the landing page is
  // Colaboradores, except for the Leadership Lab participant (COMUM), who lands on /lab. The
  // page/route is kept (reachable by direct URL) so bringing the dashboard back is just a
  // nav-items.ts change plus pointing "/" at it again.
  { path: "/", element: <HomeRedirect /> },
  {
    path: "/lab",
    element: (
      <PaginaDoLab breadcrumbs={[]}>
        <LabPainelPage />
      </PaginaDoLab>
    )
  },
  {
    path: "/lab/teste",
    element: (
      <PaginaDoLab breadcrumbs={["Teste"]}>
        <LabTestePage />
      </PaginaDoLab>
    )
  },
  {
    path: "/lab/resultado/:sessaoId",
    element: (
      <PaginaDoLab breadcrumbs={["Resultado"]}>
        <LabResultadoPage />
      </PaginaDoLab>
    )
  },
  {
    path: "/lab/aprendizagem",
    element: (
      <PaginaDoLab breadcrumbs={["Aprendizagem"]}>
        <LabAprendizagemPage />
      </PaginaDoLab>
    )
  },
  { path: "/lab/rh", element: <Navigate to="/lab/rh/revisao" replace /> },
  {
    path: "/lab/rh/revisao",
    element: (
      <PaginaDoLab breadcrumbs={["Acompanhamento", "Revisão"]}>
        <LabRevisaoPage />
      </PaginaDoLab>
    )
  },
  {
    path: "/lab/rh/revisao/:resultadoId",
    element: (
      <PaginaDoLab breadcrumbs={["Acompanhamento", "Revisão", "Resultado"]}>
        <LabFichaPage />
      </PaginaDoLab>
    )
  },
  {
    path: "/lab/rh/alertas",
    element: (
      <PaginaDoLab breadcrumbs={["Acompanhamento", "Alertas"]}>
        <LabAlertasPage />
      </PaginaDoLab>
    )
  },
  {
    path: "/lab/rh/contestacoes",
    element: (
      <PaginaDoLab breadcrumbs={["Acompanhamento", "Contestações"]}>
        <LabContestacoesPage />
      </PaginaDoLab>
    )
  },
  {
    path: "/lab/rh/contribuicoes",
    element: (
      <PaginaDoLab breadcrumbs={["Acompanhamento", "Contribuições"]}>
        <LabContribuicoesPage />
      </PaginaDoLab>
    )
  },
  {
    path: "/lab/rh/participantes",
    element: (
      <PaginaDoLab breadcrumbs={["Acompanhamento", "Participantes"]}>
        <LabParticipantesPage />
      </PaginaDoLab>
    )
  },
  {
    path: "/lab/rh/turmas",
    element: (
      <PaginaDoLab breadcrumbs={["Acompanhamento", "Turmas"]}>
        <LabTurmasPage />
      </PaginaDoLab>
    )
  },
  {
    path: "/lab/rh/turmas/:id",
    element: (
      <PaginaDoLab breadcrumbs={["Acompanhamento", "Turmas", "Turma"]}>
        <LabTurmaPage />
      </PaginaDoLab>
    )
  },
  {
    path: "/lab/config",
    element: (
      <PaginaDoLab breadcrumbs={["Configuração"]}>
        <LabConfigPage />
      </PaginaDoLab>
    )
  },
  {
    path: "/dashboard",
    element: (
      <App breadcrumbs={["MY FLUX", "Dashboard"]}>
        <DashboardPage />
      </App>
    )
  },
  ...Object.keys(resources)
    .filter((key) => !["qlp", "recrutamento", "escalas", "usuarios", "colaboradores"].includes(key))
    .map((key) => ({
      path: `/${key}`,
      element: <Wrapped resourceKey={key} />
    })),
  {
    path: "/colaboradores",
    element: (
      <App breadcrumbs={["MY FLUX", "Colaboradores"]}>
        <EmployeesPage />
      </App>
    )
  },
  {
    path: "/qlp",
    element: (
      <App breadcrumbs={["MY FLUX", "QLP"]}>
        <QlpPage />
      </App>
    )
  },
  {
    path: "/recrutamento",
    element: (
      <App breadcrumbs={["MY FLUX", "Recrutamento"]}>
        <RecruitmentPage />
      </App>
    )
  },
  {
    path: "/escalas",
    element: (
      <App breadcrumbs={["MY FLUX", "Escalas"]}>
        <MonthlySchedulePage />
      </App>
    )
  },
  {
    path: "/usuarios",
    element: (
      <App breadcrumbs={["MY FLUX", "Usuários"]}>
        <UsersPage />
      </App>
    )
  },
  {
    path: "*",
    element: (
      <App>
        <div className="rounded bg-white p-8">
          <h1 className="text-xl font-semibold">Página não encontrada</h1>
          <Link className="mt-3 inline-block text-blue-700" to="/">
            Voltar ao dashboard
          </Link>
        </div>
      </App>
    )
  }
]);
const queryClient = new QueryClient();
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);
