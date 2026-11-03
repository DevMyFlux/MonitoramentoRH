/* eslint-disable react-refresh/only-export-components */
import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, Link } from "react-router-dom";
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
import { LoadingState } from "./components/ui";
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
function PaginaDoLab({
  breadcrumbs,
  children
}: {
  breadcrumbs: string[];
  children: React.ReactNode;
}) {
  return (
    <App breadcrumbs={["MY FLUX", "Leadership Lab", ...breadcrumbs]}>
      <Suspense fallback={<LoadingState />}>{children}</Suspense>
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
