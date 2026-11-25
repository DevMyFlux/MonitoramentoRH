// Formulário de conta (criar e completar o cadastro): validação POR CAMPO, em português, no
// navegador, e a leitura dos erros por campo que a API devolve. Quem decide é sempre a API (o
// mesmo cargo/nível/área é exigido lá); aqui só se evita ir e voltar com campo em branco.
import { perfilGerencia, type PerfilDeAcesso } from "@my-flux/shared";
import { cadastroDaContaSchema } from "@my-flux/validation";

export type CampoDoFormulario =
  | "name"
  | "email"
  | "role"
  | "password"
  | "cargo"
  | "nivelGovernanca"
  | "areaId"
  | "operationId"
  | "nome";
export type ErrosDoFormulario = Partial<Record<CampoDoFormulario, string>>;

export type ValoresDoCadastro = { cargo: string; nivelGovernanca: string; areaId: string };
export type ValoresDaConta = ValoresDoCadastro & {
  name: string;
  email: string;
  role: string;
  password: string;
};

const campos: readonly CampoDoFormulario[] = [
  "name",
  "email",
  "role",
  "password",
  "cargo",
  "nivelGovernanca",
  "areaId",
  "operationId",
  "nome"
];

/** Os três campos do cadastro, com as mensagens do schema compartilhado (as mesmas da API). */
export function validarCadastro(valores: ValoresDoCadastro): ErrosDoFormulario {
  const r = cadastroDaContaSchema.safeParse({
    cargo: valores.cargo,
    nivelGovernanca: valores.nivelGovernanca || undefined,
    areaId: valores.areaId || undefined
  });
  const erros: ErrosDoFormulario = {};
  if (!r.success)
    for (const problema of r.error.issues) {
      const campo = String(problema.path[0]) as CampoDoFormulario;
      if (campos.includes(campo) && !erros[campo]) erros[campo] = problema.message;
    }
  return erros;
}

export function validarConta(
  valores: ValoresDaConta,
  exigeOperacao: boolean,
  operationId: string
): ErrosDoFormulario {
  const erros: ErrosDoFormulario = {};
  if (valores.name.trim().length < 2) erros.name = "Informe o nome (pelo menos 2 letras).";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.email.trim()))
    erros.email = "Informe um e-mail válido.";
  if (!valores.role) erros.role = "Escolha o perfil.";
  if (valores.password.length < 12)
    erros.password = "A senha inicial precisa de pelo menos 12 caracteres.";
  if (exigeOperacao && !operationId) erros.operationId = "Escolha a operação.";
  return { ...erros, ...validarCadastro(valores) };
}

/**
 * Os erros por campo de uma resposta da API (`details.issues`, com o caminho de cada problema).
 * Erro sem campo conhecido devolve {} e a tela mostra a mensagem geral.
 */
export function errosDaApi(erro: unknown): ErrosDoFormulario {
  const detalhes = (erro as { details?: { issues?: unknown } } | null)?.details;
  const problemas = Array.isArray(detalhes?.issues) ? (detalhes.issues as unknown[]) : [];
  const erros: ErrosDoFormulario = {};
  for (const problema of problemas) {
    const { path, message } = (problema ?? {}) as { path?: unknown; message?: unknown };
    const campo = Array.isArray(path) ? String(path[0]) : "";
    if (
      (campos as readonly string[]).includes(campo) &&
      typeof message === "string" &&
      !erros[campo as CampoDoFormulario]
    )
      erros[campo as CampoDoFormulario] = message;
  }
  return erros;
}

/** Os perfis que `perfilDoAtor` pode dar a uma conta (a mesma regra da API: packages/shared). */
export function perfisQueOAtorCria(perfilDoAtor: string | undefined): PerfilDeAcesso[] {
  const todos: PerfilDeAcesso[] = ["DEV", "ADMIN", "RH", "COMUM"];
  if (!todos.includes(perfilDoAtor as PerfilDeAcesso)) return [];
  return todos.filter((alvo) => perfilGerencia(perfilDoAtor as PerfilDeAcesso, alvo));
}
