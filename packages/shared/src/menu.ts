// O menu do MY FLUX e as rotas que cada perfil pode abrir, em funções puras: a API devolve o menu da
// conta (GET /auth/me) e a web usa as mesmas funções para a guarda de rota e para a página inicial.
// É arrumação da tela: quem barra os dados é a API, rota a rota.
import { decidirAcesso, type PerfilDeAcesso } from "./acessos.js";
import { moduloDaRotaWeb } from "./modules.js";

type Regra = (perfil: PerfilDeAcesso) => boolean;

// O `id` só serve às ações que não olham a pessoa, apenas o perfil.
const pode = (perfil: PerfilDeAcesso, acao: "lab:ver-acompanhamento" | "area:ler") =>
  decidirAcesso({ id: "", role: perfil }, acao, undefined).permitido;

const equipe: Regra = (perfil) => pode(perfil, "area:ler");
const acompanhaOLab: Regra = (perfil) => pode(perfil, "lab:ver-acompanhamento");
const configuraOLab: Regra = (perfil) => perfil === "ADMIN" || perfil === "DEV";

/**
 * Os itens do menu, NA ORDEM FIXA em que aparecem. Esta lista é a única definição da ordem: o menu
 * lateral, o menu do Lab, o dock e a página inicial a seguem. `noMenu` diz quem vê o item.
 */
const ITENS: readonly { rota: string; noMenu: Regra }[] = [
  // Módulos ocultos: só entram quando estiverem ativos no registro (podeAbrirRota confere).
  { rota: "/qlp", noMenu: equipe },
  { rota: "/recrutamento", noMenu: equipe },
  { rota: "/colaboradores", noMenu: equipe },
  { rota: "/escalas", noMenu: equipe },
  { rota: "/lab", noMenu: (perfil) => perfil === "COMUM" || perfil === "DEV" },
  { rota: "/lab/rh", noMenu: acompanhaOLab },
  { rota: "/lab/config", noMenu: configuraOLab },
  { rota: "/treinamentos", noMenu: (perfil) => perfil === "DEV" },
  { rota: "/treinamentos/config", noMenu: equipe },
  { rota: "/usuarios", noMenu: equipe }
];

export const rotasDoMenu: readonly string[] = ITENS.map((item) => item.rota);

const dentroDe = (caminho: string, prefixo: string) =>
  caminho === prefixo || caminho.startsWith(`${prefixo}/`);

/** Este perfil pode abrir esta rota da web? (módulo oculto: ninguém) */
export function podeAbrirRota(perfil: PerfilDeAcesso, caminho: string): boolean {
  if (moduloDaRotaWeb(caminho)?.status === "hidden") return false;
  if (dentroDe(caminho, "/lab/config")) return configuraOLab(perfil);
  if (dentroDe(caminho, "/lab/rh")) return acompanhaOLab(perfil);
  // O Lab é de todos; o resto é da equipe.
  if (dentroDe(caminho, "/lab")) return true;
  return perfil !== "COMUM";
}

/** As rotas do menu que este perfil enxerga, na ordem fixa. */
export function menuDoPerfil(perfil: PerfilDeAcesso): string[] {
  return ITENS.filter((item) => item.noMenu(perfil) && podeAbrirRota(perfil, item.rota)).map(
    (item) => item.rota
  );
}

/**
 * A página inicial: a primeira rota permitida, na ordem do menu. `permissoes` é o menu que a API
 * devolveu (sem ele, vale o do perfil). Nunca devolve uma rota que o perfil não pode abrir.
 */
export function homeFor(
  perfil: PerfilDeAcesso | undefined,
  permissoes?: readonly string[]
): string {
  if (!perfil) return "/login";
  const permitidas = new Set(permissoes ?? menuDoPerfil(perfil));
  const primeira = rotasDoMenu.find(
    (rota) => permitidas.has(rota) && podeAbrirRota(perfil, rota)
  );
  // O Lab é de todos os perfis: serve de destino quando o menu vem vazio.
  return primeira ?? "/lab";
}

/**
 * A rota pretendida antes do login, só se for interna (sem open redirect): começa com uma barra,
 * não com duas, sem barra invertida nem caractere de controle, e não é o próprio login.
 */
export function caminhoInterno(valor: unknown): string | null {
  if (typeof valor !== "string" || !valor.startsWith("/") || valor.startsWith("//")) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(valor)) return null;
  return /^\/login($|[/?#])/.test(valor) ? null : valor;
}
