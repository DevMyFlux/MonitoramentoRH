import {
  Activity,
  CalendarDays,
  FileCheck2,
  FileCog,
  FileWarning,
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

export type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const navigationGroups: NavigationGroup[] = [
  {
    label: "Visão geral",
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }]
  },
  {
    label: "Operação",
    items: [
      { label: "QLP", href: "/qlp", icon: Gauge },
      { label: "Recrutamento", href: "/recrutamento", icon: Users },
      { label: "Colaboradores", href: "/colaboradores", icon: Users },
      { label: "Escalas", href: "/escalas", icon: CalendarDays }
    ]
  },
  {
    label: "Estrutura e contratos",
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
      { label: "Planos de desenvolvimento", href: "/planos", icon: Workflow },
      { label: "Importações", href: "/importacoes", icon: FileCog },
      { label: "Auditoria", href: "/auditoria", icon: ShieldCheck },
      { label: "Usuários", href: "/usuarios", icon: UserCog },
      { label: "Parâmetros", href: "/parametros", icon: Settings }
    ]
  }
];
