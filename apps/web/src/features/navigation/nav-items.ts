import { rotasDoMenu } from "@my-flux/shared";
import {
  Activity,
  CalendarDays,
  Clapperboard,
  Compass,
  ClipboardList,
  SlidersHorizontal,
  FileCheck2,
  FileCog,
  FileWarning,
  LayoutDashboard,
  Network,
  Settings,
  Settings2,
  ShieldCheck,
  UserCog,
  Users,
  Workflow
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { itensDeMenuOcultos } from "../../_hidden/navegacao";

export type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Nome curto, para a barra de navegação inferior do celular (sem ele, usa `label`). */
  curto?: string;
  /** Temporarily hidden from the sidebar without removing the route/page/API behind it. */
  hidden?: boolean;
  /** Fica só no menu lateral (não entra no dock do celular, para ele caber em 360 px). */
  foraDoDock?: boolean;
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
      // Módulos ocultos (QLP, Recrutamento): só aparecem se estiverem ativos no registro.
      ...itensDeMenuOcultos(),
      {
        label: "Colaboradores",
        href: "/colaboradores",
        icon: Users,
        curto: "Pessoas"
      },
      {
        label: "Escalas",
        href: "/escalas",
        icon: CalendarDays,
        curto: "Escalas"
      }
    ]
  },
  {
    label: "Hub Leadership",
    // Quem vê cada item é o menu que a API devolve (packages/shared/src/menu.ts).
    items: [
      {
        label: "Leadership Lab",
        href: "/lab",
        icon: Compass,
        curto: "Lab"
      },
      {
        // O acompanhamento unificado (teste por cenários, pessoas, cenários, contestações). O RH vê
        // as turmas dele; ADMIN e DEV, tudo.
        label: "Acompanhamento do Lab",
        href: "/lab/rh",
        icon: ClipboardList,
        curto: "Gestão"
      },
      {
        label: "Configuração do Lab",
        href: "/lab/config",
        icon: SlidersHorizontal,
        curto: "Config."
      },
      // Treinamentos Interativos (o módulo antigo): os cenários agora fazem parte do teste do Lab.
      {
        label: "Treinamentos",
        href: "/treinamentos",
        icon: Clapperboard,
        curto: "Treinos"
      },
      {
        label: "Configuração de treinamentos",
        href: "/treinamentos/config",
        icon: Settings2,
        foraDoDock: true
      }
    ]
  },
  {
    label: "Administração",
    // Contas de acesso: cargo, nível de governança, área e perfil. DEV, ADMIN e RH; a API decide
    // quem gerencia quem (packages/shared, can). Fica só no menu lateral, fora do dock do celular.
    items: [
      {
        label: "Usuários",
        href: "/usuarios",
        icon: UserCog,
        foraDoDock: true
      }
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
    hidden: true,
    items: [
      { label: "Planos de desenvolvimento", href: "/planos", icon: Workflow },
      { label: "Importações", href: "/importacoes", icon: FileCog },
      { label: "Auditoria", href: "/auditoria", icon: ShieldCheck },
      { label: "Parâmetros", href: "/parametros", icon: Settings }
    ]
  }
];

const posicao = (item: NavigationItem) => rotasDoMenu.indexOf(item.href);

/**
 * Os grupos do menu com apenas o que a API permitiu (`user.menu` de GET /auth/me): o resto não é
 * desenhado. A ordem é a fixa de `rotasDoMenu` (packages/shared), a mesma em qualquer página e
 * qualquer que seja a ordem da resposta. Sem permissões conhecidas, o menu fica vazio.
 */
export function gruposVisiveis(permitidas: readonly string[] = []): NavigationGroup[] {
  return navigationGroups
    .filter((grupo) => !grupo.hidden)
    .map((grupo) => ({
      ...grupo,
      items: grupo.items
        .filter((item) => !item.hidden && permitidas.includes(item.href))
        .sort((a, b) => posicao(a) - posicao(b))
    }))
    .filter((grupo) => grupo.items.length > 0);
}

/** Os itens da barra de navegação inferior (celular): os mesmos do menu, na mesma ordem. */
export function itensDoDock(permitidas?: readonly string[]): NavigationItem[] {
  return gruposVisiveis(permitidas)
    .flatMap((grupo) => grupo.items)
    .filter((item) => !item.foraDoDock);
}

/**
 * O item que a página destaca: o de endereço mais específico que a contém (as rotas filhas contam:
 * /lab/rh/revisao destaca /lab/rh, e não /lab). Destacar não muda a posição de nada.
 */
export function itemAtivo(pathname: string, itens: readonly NavigationItem[]): string | null {
  const candidatos = itens
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`));
  return candidatos.sort((a, b) => b.length - a.length)[0] ?? null;
}
