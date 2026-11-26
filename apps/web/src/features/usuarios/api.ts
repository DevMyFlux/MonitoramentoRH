// Usuários: chamadas à API (/users, /areas, /operations) e os tipos das respostas. Quem decide o que
// cada perfil pode é a API (packages/shared, can); a tela só mostra o que ela devolve.
import type { CampoDoCadastro } from "@my-flux/shared";
import { request } from "../my-flux/client";

export type Conta = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  cargo: string | null;
  nivelGovernanca: string | null;
  area: { id: string; nome: string } | null;
  role: { name: string };
  scopes: { isGlobal: boolean; operationId?: string | null }[];
  /** O que falta no cadastro (vazio = completo). */
  cadastroIncompleto: CampoDoCadastro[];
};

export type AreaDaLista = {
  id: string;
  slug: string;
  nome: string;
  ativa: boolean;
  usuarios: number;
};
export type OperacaoDaLista = { id: string; name: string };

export type NovaConta = {
  name: string;
  email: string;
  password: string;
  role: string;
  cargo: string;
  nivelGovernanca: string;
  areaId: string;
  scopes: { isGlobal: boolean; operationId?: string | null }[];
};

export type CadastroEditado = { cargo: string; nivelGovernanca: string; areaId: string };

export const apiDeUsuarios = {
  contas: (apenasPendentes: boolean) =>
    request<Conta[]>(apenasPendentes ? "/users?pendentes=1" : "/users"),
  areas: () => request<AreaDaLista[]>("/areas"),
  operacoes: () => request<OperacaoDaLista[]>("/operations"),
  criar: (conta: NovaConta) => request<{ user: { id: string } }>("/users", "POST", conta),
  editarCadastro: (id: string, cadastro: CadastroEditado) =>
    request<{ id: string }>(`/users/${id}`, "PATCH", cadastro),
  alterarSituacao: (id: string, isActive: boolean) =>
    request<{ id: string; isActive: boolean }>(`/users/${id}/status`, "PATCH", { isActive }),
  criarArea: (nome: string) => request<AreaDaLista>("/areas", "POST", { nome }),
  editarArea: (id: string, mudancas: { nome?: string; ativa?: boolean }) =>
    request<AreaDaLista>(`/areas/${id}`, "PATCH", mudancas)
};
