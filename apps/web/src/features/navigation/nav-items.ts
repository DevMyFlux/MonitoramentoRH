import {
  Activity,
  CalendarDays,
  FileCheck2,
  FileCog,
  FileWarning,
  KeyRound,
  Gauge,
  LayoutDashboard,
  Network,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  Workflow
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PermissionCode } from "@my-flux/shared";

export type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Temporarily hidden from the sidebar without removing the route/page/API behind it. */
  hidden?: boolean;
  /** O item só aparece para quem tem esta permissão (a API valida de novo no servidor). */
  permission?: PermissionCode;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
  /** Temporarily hidden from the sidebar without removing the routes/pages/APIs behind it. */
  hidden?: boolean;
};

/**
 * Scope restriction (temporary): this phase of development is limited to
 * "Colaboradores" and "Escalas". Every other area below is marked `hidden: true`
 * instead of being deleted — routes, pages, components and API endpoints keep
 * working normally if opened by direct URL. To bring an area back into the
 * sidebar, remove its `hidden: true` (or the whole group's, if every item in
 * it is being restored).
 */
export const navigationGroups: NavigationGroup[] = [
  {
    label: "Visão geral",
    hidden: true,
    // Dashboard is hidden for now: "/" redirects to Colaboradores (main.tsx) and the
    // page itself stays reachable at /dashboard, untouched, for when it comes back.
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, hidden: true }]
  },
  {
    label: "Operação",
    items: [
      { label: "QLP", href: "/qlp", icon: Gauge, hidden: true },
      { label: "Recrutamento", href: "/recrutamento", icon: Users, hidden: true },
      { label: "Colaboradores", href: "/colaboradores", icon: Users },
      { label: "Escalas", href: "/escalas", icon: CalendarDays }
    ]
  },
  {
    label: "Estrutura e contratos",
    hidden: true,
    items: [
      { label: "Empresas", href: "/empresas", icon: Network },
      { label: "Clientes", href: "/clientes", icon: Network },
      { label: "Contratos", href: "/contratos", icon: FileCog },
      { label: "Unidades", href: "/unidades", icon: Network },
      { label: "Operações", href: "/operacoes", icon: Activity },
      { label: "Serviços", href: "/servicos", icon: Workflow },
      { label: "Obrigações", href: "/obrigacoes", icon: FileCheck2 },
      { label: "Funções", href: "/funcoes", icon: Users }
    ]
  },
  {
    label: "Pessoas",
    hidden: true,
    items: [
      { label: "Documentos", href: "/documentos", icon: FileWarning },
      { label: "Competências", href: "/competencias", icon: ShieldCheck },
      { label: "Matriz", href: "/matriz", icon: ShieldCheck },
      { label: "Avaliações", href: "/avaliacoes", icon: FileCheck2 },
      { label: "Eventos", href: "/eventos", icon: CalendarDays }
    ]
  },
  {
    label: "Gestão",
    items: [
      { label: "Planos de desenvolvimento", href: "/planos", icon: Workflow, hidden: true },
      { label: "Importações", href: "/importacoes", icon: FileCog, hidden: true },
      { label: "Auditoria", href: "/auditoria", icon: ShieldCheck, permission: "audit:read" },
      { label: "Usuários", href: "/usuarios", icon: UserCog, permission: "users:manage" },
      {
        label: "Perfis e permissões",
        href: "/perfis",
        icon: KeyRound,
        permission: "permissions:manage"
      },
      { label: "Parâmetros", href: "/parametros", icon: Settings, hidden: true }
    ]
  }
];
