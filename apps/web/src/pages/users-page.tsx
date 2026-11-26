// Usuários e perfis: contas de acesso com CARGO, NÍVEL DE GOVERNANÇA e ÁREA (obrigatórios em conta
// nova e ao editar uma antiga), o selo "Cadastro incompleto" para quem ainda não tem os três, e a
// lista de áreas (DEV e ADMIN editam). Quem pode criar, editar ou bloquear cada perfil é decidido
// pela API (packages/shared, can); a tela só mostra o que ela permite.
import {
  niveisDeGovernanca,
  rotuloDoCampoDoCadastro,
  rotuloDoNivel,
  type NivelDeGovernanca
} from "@my-flux/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CircleAlert, CircleCheck, Pencil, Plus, ShieldCheck, UserCog } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  AvisoTemporario,
  Button,
  CampoDeSelecao,
  CampoDeTexto,
  Dica,
  EmptyState,
  ErrorState,
  Skeleton,
  TituloDePagina
} from "../components/ui";
import { useUsuarioAtual } from "../features/auth/use-usuario-atual";
import { apiDeUsuarios, type AreaDaLista, type Conta } from "../features/usuarios/api";
import {
  errosDaApi,
  perfisQueOAtorCria,
  validarCadastro,
  validarConta,
  type ErrosDoFormulario
} from "../features/usuarios/formulario";
import { cn } from "../lib/cn";

const SENHA_INICIAL_PADRAO = "ChangeMe!2026";

const nomeDoNivel = (nivel: string | null) =>
  nivel && nivel in rotuloDoNivel ? rotuloDoNivel[nivel as NivelDeGovernanca] : "—";

const opcoesDeNivel = [
  { value: "", label: "Selecione o nível" },
  ...niveisDeGovernanca.map((n) => ({ value: n, label: rotuloDoNivel[n] }))
];

export function UsersPage() {
  const cache = useQueryClient();
  const ator = useUsuarioAtual().data;
  const [soPendentes, setSoPendentes] = useState(false);
  const [aviso, setAviso] = useState("");
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Conta | null>(null);

  const contas = useQuery({
    queryKey: ["usuarios", "contas", soPendentes],
    queryFn: () => apiDeUsuarios.contas(soPendentes),
    retry: false
  });
  const todasAsContas = useQuery({
    queryKey: ["usuarios", "contas", false],
    queryFn: () => apiDeUsuarios.contas(false),
    retry: false,
    enabled: soPendentes
  });
  const areas = useQuery({
    queryKey: ["usuarios", "areas"],
    queryFn: apiDeUsuarios.areas,
    retry: false
  });

  const perfisCriaveis = perfisQueOAtorCria(ator?.role);
  const podeEditarAreas = ator?.role === "DEV" || ator?.role === "ADMIN";
  const lista = contas.data ?? [];
  const totalPendentes = (soPendentes ? (todasAsContas.data ?? lista) : lista).filter(
    (c) => c.cadastroIncompleto.length > 0
  ).length;

  function recarregar() {
    void cache.invalidateQueries({ queryKey: ["usuarios"] });
  }

  async function alternarSituacao(conta: Conta) {
    try {
      const r = await apiDeUsuarios.alterarSituacao(conta.id, !conta.isActive);
      setAviso(r.isActive ? "Usuário reativado." : "Usuário bloqueado e sessões revogadas.");
      recarregar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não foi possível alterar a situação.");
    }
  }

  return (
    <div className="space-y-6">
      <TituloDePagina
        etiqueta="MY FLUX · Administração"
        titulo="Usuários e perfis"
        descricao={`${ator ? `Você está conectado como ${ator.role}.` : "Carregando seu perfil..."} Toda conta tem cargo, nível de governança e área; a hierarquia e o escopo são validados pela API.`}
        acoes={
          <Button
            icon={<Plus size={16} />}
            onClick={() => setCriando(true)}
            disabled={perfisCriaveis.length === 0}
          >
            Novo usuário
          </Button>
        }
      />
      <AvisoTemporario mensagem={aviso} aoFechar={() => setAviso("")} />

      {totalPendentes > 0 || soPendentes ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-mf-cartao border border-mf-alerta/25 bg-mf-alerta-suave p-4 text-sm text-mf-alerta"
        >
          <CircleAlert size={18} aria-hidden="true" />
          <p className="min-w-0 flex-1">
            {totalPendentes === 0
              ? "Nenhuma conta com cadastro incompleto."
              : `${totalPendentes} ${totalPendentes === 1 ? "conta está" : "contas estão"} sem cargo, nível de governança ou área.`}
          </p>
          <Button
            variant="secondary"
            size="sm"
            aria-pressed={soPendentes}
            onClick={() => setSoPendentes(!soPendentes)}
          >
            {soPendentes ? "Ver todas as contas" : "Ver só as pendentes"}
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-mf-cartao border border-mf-linha bg-mf-cartao shadow-mf-1">
        <div className="flex items-center gap-3 border-b border-mf-linha p-4">
          <ShieldCheck size={17} aria-hidden="true" className="text-mf-primaria" />
          <span className="text-sm text-mf-texto-2">
            Hierarquia: DEV &gt; ADMIN &gt; RH &gt; COMUM
          </span>
          <span className="ml-auto text-xs tabular-nums text-mf-texto-3">
            {lista.length} {lista.length === 1 ? "usuário" : "usuários"}
          </span>
        </div>
        {contas.isPending ? (
          <div role="status" aria-label="Carregando usuários" className="space-y-3 p-5">
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} className="h-10 w-full" />
            ))}
          </div>
        ) : contas.isError ? (
          <div className="p-4">
            <ErrorState
              title="Não foi possível carregar os usuários"
              description={contas.error.message}
              onRetry={() => void contas.refetch()}
            />
          </div>
        ) : lista.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={soPendentes ? "Nenhuma conta pendente" : "Nenhum usuário neste escopo"}
              description={
                soPendentes
                  ? "Todas as contas que você vê estão com o cadastro completo."
                  : "Os usuários que você pode administrar aparecem aqui. Crie o primeiro com Novo usuário."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-mf-fundo text-xs uppercase tracking-wide text-mf-texto-3">
                <tr>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Cargo, nível e área</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mf-linha">
                {lista.map((conta) => (
                  <tr key={conta.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-mf-tinta">{conta.name}</div>
                      <div className="text-xs text-mf-texto-2">{conta.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {conta.cadastroIncompleto.length > 0 ? (
                        <Dica
                          texto={`Falta: ${conta.cadastroIncompleto.map((c) => rotuloDoCampoDoCadastro[c]).join(", ")}`}
                          className="no-underline"
                        >
                          <span className="inline-flex items-center gap-1 rounded-full bg-mf-alerta-suave px-2 py-1 text-xs font-semibold text-mf-alerta ring-1 ring-inset ring-mf-alerta/25">
                            <CircleAlert size={12} aria-hidden="true" />
                            Cadastro incompleto
                          </span>
                        </Dica>
                      ) : (
                        <>
                          <div className="text-mf-texto">{conta.cargo}</div>
                          <div className="text-xs text-mf-texto-2">
                            {nomeDoNivel(conta.nivelGovernanca)} · {conta.area?.nome ?? "—"}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-mf-texto">{conta.role.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
                          conta.isActive
                            ? "bg-mf-realce-suave text-mf-primaria"
                            : "bg-mf-perigo-suave text-mf-perigo"
                        )}
                      >
                        {conta.isActive ? (
                          <CircleCheck size={12} aria-hidden="true" />
                        ) : (
                          <Ban size={12} aria-hidden="true" />
                        )}
                        {conta.isActive ? "Ativo" : "Bloqueado"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Pencil size={14} />}
                          onClick={() => setEditando(conta)}
                        >
                          {conta.cadastroIncompleto.length > 0 ? "Completar" : "Editar"}
                          <span className="sr-only"> o cadastro de {conta.name}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void alternarSituacao(conta)}
                        >
                          {conta.isActive ? "Bloquear" : "Reativar"}
                          <span className="sr-only"> {conta.name}</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PainelDeAreas
        areas={areas.data ?? []}
        carregando={areas.isPending}
        podeEditar={podeEditarAreas}
        aoMudar={recarregar}
        aoAvisar={setAviso}
      />

      {criando ? (
        <JanelaDeConta
          aoFechar={() => setCriando(false)}
          perfis={perfisCriaveis}
          areas={(areas.data ?? []).filter((a) => a.ativa)}
          ehDev={ator?.role === "DEV"}
          aoCriar={() => {
            setCriando(false);
            setAviso("Usuário criado com cadastro completo e registro de auditoria.");
            recarregar();
          }}
        />
      ) : null}
      {editando ? (
        <JanelaDoCadastro
          conta={editando}
          areas={(areas.data ?? []).filter((a) => a.ativa || a.id === editando.area?.id)}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            setAviso("Cadastro salvo e auditado.");
            recarregar();
          }}
        />
      ) : null}
    </div>
  );
}

/** Janela acessível: foco no título ao abrir, Esc e clique fora fecham. */
function Janela({
  titulo,
  descricao,
  aoFechar,
  children
}: {
  titulo: string;
  descricao: string;
  aoFechar: () => void;
  children: ReactNode;
}) {
  const tituloRef = useRef<HTMLHeadingElement>(null);
  // O foco vai para o título só ao abrir; o Esc usa sempre o aoFechar mais recente.
  useEffect(() => {
    tituloRef.current?.focus();
  }, []);
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") aoFechar();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-mf-tinta/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-da-janela"
        className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-mf-conteiner bg-mf-cartao p-6 shadow-mf-3"
      >
        <div className="flex items-center gap-3">
          <UserCog aria-hidden="true" className="text-mf-primaria" />
          <div>
            <h2
              id="titulo-da-janela"
              ref={tituloRef}
              tabIndex={-1}
              className="font-display text-lg font-bold text-mf-tinta outline-none"
            >
              {titulo}
            </h2>
            <p className="text-sm text-mf-texto-2">{descricao}</p>
          </div>
        </div>
        {children}
      </section>
    </div>
  );
}

function MensagemGeral({ texto }: { texto: string }) {
  return texto ? (
    <p
      role="alert"
      className="rounded-mf-controle border border-mf-perigo/20 bg-mf-perigo-suave p-3 text-sm text-mf-perigo sm:col-span-2"
    >
      {texto}
    </p>
  ) : null;
}

function JanelaDeConta({
  perfis,
  areas,
  ehDev,
  aoFechar,
  aoCriar
}: {
  perfis: string[];
  areas: AreaDaLista[];
  ehDev: boolean;
  aoFechar: () => void;
  aoCriar: () => void;
}) {
  const operacoes = useQuery({
    queryKey: ["usuarios", "operacoes"],
    queryFn: apiDeUsuarios.operacoes,
    retry: false
  });
  const [valores, setValores] = useState({
    name: "",
    email: "",
    role: perfis.at(-1) ?? "",
    password: SENHA_INICIAL_PADRAO,
    cargo: "",
    nivelGovernanca: "",
    areaId: ""
  });
  const [operationId, setOperationId] = useState("");
  const [global, setGlobal] = useState(false);
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const [erroGeral, setErroGeral] = useState("");
  const [enviando, setEnviando] = useState(false);
  const escopoGlobal = valores.role === "DEV" && global;
  const operacaoEscolhida = operationId || operacoes.data?.[0]?.id || "";
  const campo =
    <K extends keyof typeof valores>(chave: K) =>
    (valor: string) => {
      setValores((v) => ({ ...v, [chave]: valor }));
      setErros((e) => ({ ...e, [chave]: undefined }));
    };

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErroGeral("");
    const encontrados = validarConta(valores, !escopoGlobal, operacaoEscolhida);
    if (Object.values(encontrados).some(Boolean)) return setErros(encontrados);
    setEnviando(true);
    try {
      await apiDeUsuarios.criar({
        ...valores,
        name: valores.name.trim(),
        email: valores.email.trim(),
        cargo: valores.cargo.trim(),
        scopes: escopoGlobal
          ? [{ isGlobal: true }]
          : [{ isGlobal: false, operationId: operacaoEscolhida }]
      });
      aoCriar();
    } catch (e) {
      const doServidor = errosDaApi(e);
      if (Object.keys(doServidor).length) setErros(doServidor);
      else setErroGeral(e instanceof Error ? e.message : "Não foi possível criar o usuário.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Janela
      titulo="Criar usuário"
      descricao="Todos os campos são obrigatórios. A API impede elevação de perfil e escopo."
      aoFechar={aoFechar}
    >
      <form onSubmit={(e) => void enviar(e)} noValidate className="mt-5 grid gap-4 sm:grid-cols-2">
        <CampoDeTexto
          rotulo="Nome"
          valor={valores.name}
          aoMudar={campo("name")}
          obrigatorio
          erro={erros.name ?? ""}
        />
        <CampoDeTexto
          rotulo="E-mail"
          tipo="email"
          valor={valores.email}
          aoMudar={campo("email")}
          obrigatorio
          erro={erros.email ?? ""}
        />
        <CampoDeTexto
          rotulo="Cargo"
          valor={valores.cargo}
          aoMudar={campo("cargo")}
          obrigatorio
          tamanhoMaximo={120}
          erro={erros.cargo ?? ""}
        />
        <CampoDeSelecao
          rotulo="Nível de governança"
          valor={valores.nivelGovernanca}
          aoMudar={campo("nivelGovernanca")}
          opcoes={opcoesDeNivel}
          obrigatorio
          erro={erros.nivelGovernanca ?? ""}
        />
        <CampoDeSelecao
          rotulo="Área"
          valor={valores.areaId}
          aoMudar={campo("areaId")}
          opcoes={[
            { value: "", label: "Selecione a área" },
            ...areas.map((a) => ({ value: a.id, label: a.nome }))
          ]}
          obrigatorio
          erro={erros.areaId ?? ""}
        />
        <CampoDeSelecao
          rotulo="Perfil de acesso"
          valor={valores.role}
          aoMudar={(v) => {
            campo("role")(v);
            setGlobal(v === "DEV");
          }}
          opcoes={perfis.map((p) => ({ value: p, label: p }))}
          obrigatorio
          erro={erros.role ?? ""}
        />
        <CampoDeTexto
          rotulo="Senha inicial"
          tipo="password"
          valor={valores.password}
          aoMudar={campo("password")}
          obrigatorio
          erro={erros.password ?? ""}
        />
        {valores.role === "DEV" && ehDev ? (
          <label className="flex items-center gap-2 text-sm text-mf-texto sm:col-span-2">
            <input type="checkbox" checked={global} onChange={(e) => setGlobal(e.target.checked)} />
            Escopo global de DEV
          </label>
        ) : (
          <CampoDeSelecao
            className="sm:col-span-2"
            rotulo="Operação"
            valor={operacaoEscolhida}
            aoMudar={setOperationId}
            opcoes={(operacoes.data ?? []).map((o) => ({ value: o.id, label: o.name }))}
            obrigatorio
            erro={erros.operationId ?? ""}
          />
        )}
        <MensagemGeral texto={erroGeral} />
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando} aria-busy={enviando}>
            {enviando ? "Criando..." : "Criar e auditar"}
          </Button>
        </div>
      </form>
    </Janela>
  );
}

function JanelaDoCadastro({
  conta,
  areas,
  aoFechar,
  aoSalvar
}: {
  conta: Conta;
  areas: AreaDaLista[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [valores, setValores] = useState({
    cargo: conta.cargo ?? "",
    nivelGovernanca: conta.nivelGovernanca ?? "",
    areaId: conta.area?.id ?? ""
  });
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const [erroGeral, setErroGeral] = useState("");
  const [enviando, setEnviando] = useState(false);
  const campo =
    <K extends keyof typeof valores>(chave: K) =>
    (valor: string) => {
      setValores((v) => ({ ...v, [chave]: valor }));
      setErros((e) => ({ ...e, [chave]: undefined }));
    };

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErroGeral("");
    const encontrados = validarCadastro(valores);
    if (Object.values(encontrados).some(Boolean)) return setErros(encontrados);
    setEnviando(true);
    try {
      await apiDeUsuarios.editarCadastro(conta.id, { ...valores, cargo: valores.cargo.trim() });
      aoSalvar();
    } catch (e) {
      const doServidor = errosDaApi(e);
      if (Object.keys(doServidor).length) setErros(doServidor);
      else setErroGeral(e instanceof Error ? e.message : "Não foi possível salvar o cadastro.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Janela
      titulo={conta.cadastroIncompleto.length > 0 ? "Completar cadastro" : "Editar cadastro"}
      descricao={`${conta.name} · ${conta.email}. Cargo, nível e área são obrigatórios.`}
      aoFechar={aoFechar}
    >
      <form onSubmit={(e) => void enviar(e)} noValidate className="mt-5 grid gap-4 sm:grid-cols-2">
        <CampoDeTexto
          className="sm:col-span-2"
          rotulo="Cargo"
          valor={valores.cargo}
          aoMudar={campo("cargo")}
          obrigatorio
          tamanhoMaximo={120}
          erro={erros.cargo ?? ""}
        />
        <CampoDeSelecao
          rotulo="Nível de governança"
          valor={valores.nivelGovernanca}
          aoMudar={campo("nivelGovernanca")}
          opcoes={opcoesDeNivel}
          obrigatorio
          erro={erros.nivelGovernanca ?? ""}
        />
        <CampoDeSelecao
          rotulo="Área"
          valor={valores.areaId}
          aoMudar={campo("areaId")}
          opcoes={[
            { value: "", label: "Selecione a área" },
            ...areas.map((a) => ({ value: a.id, label: a.ativa ? a.nome : `${a.nome} (inativa)` }))
          ]}
          obrigatorio
          erro={erros.areaId ?? ""}
        />
        <MensagemGeral texto={erroGeral} />
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando} aria-busy={enviando}>
            {enviando ? "Salvando..." : "Salvar cadastro"}
          </Button>
        </div>
      </form>
    </Janela>
  );
}

/** As áreas da empresa: todos da equipe veem; DEV e ADMIN criam, renomeiam e ativam/desativam. */
function PainelDeAreas({
  areas,
  carregando,
  podeEditar,
  aoMudar,
  aoAvisar
}: {
  areas: AreaDaLista[];
  carregando: boolean;
  podeEditar: boolean;
  aoMudar: () => void;
  aoAvisar: (mensagem: string) => void;
}) {
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  const ordenadas = useMemo(
    () =>
      [...areas].sort((a, b) => Number(b.ativa) - Number(a.ativa) || a.nome.localeCompare(b.nome)),
    [areas]
  );

  async function criar(evento: FormEvent) {
    evento.preventDefault();
    setErro("");
    try {
      await apiDeUsuarios.criarArea(nome.trim());
      setNome("");
      aoAvisar("Área criada.");
      aoMudar();
    } catch (e) {
      setErro(
        errosDaApi(e).nome ?? (e instanceof Error ? e.message : "Não foi possível criar a área.")
      );
    }
  }

  async function salvar(id: string, mudancas: { nome?: string; ativa?: boolean }) {
    setErro("");
    try {
      await apiDeUsuarios.editarArea(id, mudancas);
      setEditando(null);
      aoMudar();
    } catch (e) {
      setErro(
        errosDaApi(e).nome ?? (e instanceof Error ? e.message : "Não foi possível salvar a área.")
      );
    }
  }

  return (
    <details className="rounded-mf-cartao border border-mf-linha bg-mf-cartao p-4 shadow-mf-1">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-display text-lg font-bold text-mf-tinta">
        Áreas
        <span className="rounded-full bg-mf-fundo px-2 py-0.5 text-xs font-medium tabular-nums text-mf-texto-2">
          {areas.length}
        </span>
      </summary>
      <p className="mt-1 text-sm text-mf-texto-2">
        A área da pessoa, junto com o nível de governança, define o público dos treinamentos.
        {podeEditar ? "" : " Só DEV e ADMIN editam a lista."}
      </p>
      {carregando ? <Skeleton className="mt-3 h-16 w-full" /> : null}
      <ul className="mt-3 divide-y divide-mf-linha rounded-mf-controle border border-mf-linha">
        {ordenadas.map((area) => (
          <li key={area.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
            {editando?.id === area.id ? (
              <form
                className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void salvar(area.id, { nome: editando.nome.trim() });
                }}
              >
                <input
                  aria-label={`Novo nome da área ${area.nome}`}
                  value={editando.nome}
                  onChange={(e) => setEditando({ id: area.id, nome: e.target.value })}
                  className="h-11 min-w-0 flex-1 rounded-mf-controle border border-mf-linha px-3"
                />
                <Button type="submit" size="sm">
                  Salvar
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(null)}>
                  Cancelar
                </Button>
              </form>
            ) : (
              <>
                <span
                  className={cn(
                    "font-medium",
                    area.ativa ? "text-mf-tinta" : "text-mf-texto-3 line-through"
                  )}
                >
                  {area.nome}
                </span>
                <span className="text-xs text-mf-texto-3">
                  {area.usuarios} {area.usuarios === 1 ? "conta" : "contas"}
                  {area.ativa ? "" : " · inativa"}
                </span>
                {podeEditar ? (
                  <span className="ml-auto flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditando({ id: area.id, nome: area.nome })}
                    >
                      Renomear<span className="sr-only"> {area.nome}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void salvar(area.id, { ativa: !area.ativa })}
                    >
                      {area.ativa ? "Desativar" : "Ativar"}
                      <span className="sr-only"> {area.nome}</span>
                    </Button>
                  </span>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>
      {podeEditar ? (
        <form onSubmit={(e) => void criar(e)} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 basis-56 text-sm font-medium text-mf-texto">
            Nova área
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={80}
              className="mt-1 block h-11 w-full rounded-mf-controle border border-mf-linha px-3 text-sm font-normal"
            />
          </label>
          <Button type="submit" disabled={nome.trim().length < 2} icon={<Plus size={16} />}>
            Adicionar área
          </Button>
        </form>
      ) : null}
      {erro ? (
        <p role="alert" className="mt-2 text-sm text-mf-perigo">
          {erro}
        </p>
      ) : null}
    </details>
  );
}
