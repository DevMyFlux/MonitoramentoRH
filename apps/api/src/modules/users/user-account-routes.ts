// Cadastro das contas de acesso: cargo, nível de governança e área.
//
//   GET   /areas        as áreas (com quantas contas usam cada uma). DEV, ADMIN, RH.
//   POST  /areas        { nome } cria uma área. DEV e ADMIN.
//   PATCH /areas/:id    { nome?, ativa? } renomeia ou ativa/desativa. DEV e ADMIN.
//   PATCH /users/:id    { name?, cargo, nivelGovernanca, areaId } completa ou corrige o cadastro de
//                       uma conta (inclusive antiga): os três campos juntos, sempre completos.
//
// Quem pode é decidido por can() (packages/shared). Uma conta que o ator não pode editar responde
// 404 igual a "não existe": não revela que a pessoa existe. A auditoria (AuditLog) entra na MESMA
// transação da mudança.
import { decidirAcesso, rotuloDoCampoDoCadastro, type CampoDoCadastro } from "@my-flux/shared";
import {
  areaCreateSchema,
  areaUpdateSchema,
  idParamsSchema,
  updateUserRegistrationSchema
} from "@my-flux/validation";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { HttpError } from "../../lib/http-error.js";
import { authenticateRequest } from "../auth/auth-routes.js";
import { assertAreaAtiva, type UserRepository } from "./user-repository.js";

const NAO_ENCONTRADO = () => new HttpError(404, "USER_NOT_FOUND", "Usuário não encontrado.");

/** "Manutenção Elétrica" → "manutencao-eletrica" (sem acento, minúsculas, hífens). */
export function slugDaArea(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

const ehConflito = (erro: unknown) =>
  erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";

const conflitoDeNome = () =>
  new HttpError(409, "AREA_JA_EXISTE", "Já existe uma área com esse nome.", {
    issues: [{ path: ["nome"], message: "Já existe uma área com esse nome." }]
  });

export async function registrarRotasDeCadastroDaConta(
  app: FastifyInstance,
  users: UserRepository,
  db: PrismaClient
): Promise<void> {
  const quem = async (request: Parameters<typeof authenticateRequest>[0]) =>
    authenticateRequest(request, users);

  app.get("/areas", async (request) => {
    const ator = await quem(request);
    if (!decidirAcesso(ator, "area:ler", undefined).permitido)
      throw new HttpError(403, "FORBIDDEN", "Perfil sem permissão para esta ação.");
    const areas = await db.area.findMany({
      orderBy: { nome: "asc" },
      select: {
        id: true,
        slug: true,
        nome: true,
        ativa: true,
        _count: { select: { usuarios: true } }
      }
    });
    return {
      data: areas.map(({ _count, ...area }) => ({ ...area, usuarios: _count.usuarios }))
    };
  });

  app.post("/areas", async (request, reply) => {
    const ator = await quem(request);
    if (!decidirAcesso(ator, "area:editar", undefined).permitido)
      throw new HttpError(403, "FORBIDDEN", "Perfil sem permissão para esta ação.");
    const { nome } = areaCreateSchema.parse(request.body);
    const slug = slugDaArea(nome);
    if (slug.length < 2) throw conflitoDeNome();
    try {
      const area = await db.$transaction(async (tx) => {
        const criada = await tx.area.create({
          data: { slug, nome, createdBy: ator.id, updatedBy: ator.id },
          select: { id: true, slug: true, nome: true, ativa: true }
        });
        await tx.auditLog.create({
          data: {
            userId: ator.id,
            userRole: ator.role,
            action: "CREATE",
            entity: "Area",
            entityId: criada.id,
            after: { nome: criada.nome, slug: criada.slug },
            origin: "api"
          }
        });
        return criada;
      });
      return reply.status(201).send({ data: { ...area, usuarios: 0 } });
    } catch (erro) {
      if (ehConflito(erro)) throw conflitoDeNome();
      // O índice de nome sem diferença de maiúsculas também lança violação de unicidade.
      if (erro instanceof Error && /Area_nome_lower_key/.test(erro.message)) throw conflitoDeNome();
      throw erro;
    }
  });

  app.patch("/areas/:id", async (request) => {
    const ator = await quem(request);
    if (!decidirAcesso(ator, "area:editar", undefined).permitido)
      throw new HttpError(403, "FORBIDDEN", "Perfil sem permissão para esta ação.");
    const { id } = idParamsSchema.parse(request.params);
    const mudancas = areaUpdateSchema.parse(request.body);
    try {
      return {
        data: await db.$transaction(async (tx) => {
          const antes = await tx.area.findUnique({ where: { id } });
          if (!antes) throw new HttpError(404, "AREA_NOT_FOUND", "Área não encontrada.");
          const depois = await tx.area.update({
            where: { id },
            // O slug não muda ao renomear: ele identifica a área em regras e relatórios.
            data: {
              ...(mudancas.nome !== undefined ? { nome: mudancas.nome } : {}),
              ...(mudancas.ativa !== undefined ? { ativa: mudancas.ativa } : {}),
              updatedBy: ator.id
            },
            select: { id: true, slug: true, nome: true, ativa: true }
          });
          await tx.auditLog.create({
            data: {
              userId: ator.id,
              userRole: ator.role,
              action: "UPDATE",
              entity: "Area",
              entityId: id,
              before: { nome: antes.nome, ativa: antes.ativa },
              after: { nome: depois.nome, ativa: depois.ativa },
              origin: "api"
            }
          });
          return depois;
        })
      };
    } catch (erro) {
      if (ehConflito(erro)) throw conflitoDeNome();
      throw erro;
    }
  });

  app.patch("/users/:id", async (request) => {
    const ator = await quem(request);
    const { id } = idParamsSchema.parse(request.params);
    const cadastro = updateUserRegistrationSchema.parse(request.body);
    return {
      data: await db.$transaction(async (tx) => {
        const alvo = await tx.user.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            createdBy: true,
            cargo: true,
            nivelGovernanca: true,
            areaId: true,
            role: { select: { name: true } }
          }
        });
        if (!alvo) throw NAO_ENCONTRADO();
        const decisao = decidirAcesso(ator, "usuario:editar", {
          id: alvo.id,
          perfil: alvo.role.name
        });
        // Mesma regra de visibilidade da lista: fora o DEV, cada um mexe nas contas que criou.
        if (!decisao.permitido || (ator.role !== "DEV" && alvo.createdBy !== ator.id))
          throw NAO_ENCONTRADO();
        await assertAreaAtiva(tx, cadastro.areaId);
        const atualizado = await tx.user.update({
          where: { id },
          data: {
            ...(cadastro.name !== undefined ? { name: cadastro.name } : {}),
            cargo: cadastro.cargo,
            nivelGovernanca: cadastro.nivelGovernanca,
            areaId: cadastro.areaId,
            updatedBy: ator.id
          },
          select: {
            id: true,
            name: true,
            cargo: true,
            nivelGovernanca: true,
            area: { select: { id: true, nome: true } }
          }
        });
        await tx.auditLog.create({
          data: {
            userId: ator.id,
            userRole: ator.role,
            action: "UPDATE",
            entity: "User",
            entityId: id,
            before: {
              cargo: alvo.cargo,
              nivelGovernanca: alvo.nivelGovernanca,
              areaId: alvo.areaId
            },
            after: {
              cargo: cadastro.cargo,
              nivelGovernanca: cadastro.nivelGovernanca,
              areaId: cadastro.areaId
            },
            origin: "api"
          }
        });
        return atualizado;
      })
    };
  });
}

/** Os campos que faltam numa conta, já com o nome em português (para a lista e o selo). */
export function rotulosDoQueFalta(campos: CampoDoCadastro[]): string[] {
  return campos.map((campo) => rotuloDoCampoDoCadastro[campo]);
}
