/* eslint-disable react-hooks/set-state-in-effect */
// Treinamentos Interativos — configuração (ADMIN, DEV): enviar um cenário em JSON, validar (com os
// problemas no caminho exato), pré-visualizar no Palco, salvar como cenário novo ou nova versão,
// aprovar (congela a versão) e atribuir a uma turma do Leadership Lab. Quem decide e barra é a API;
// a tela só organiza o trabalho. Todo conteúdo nasce como rascunho até a validação técnica.
import { validarCenario, validarCenarioImportado, type TreinoCenario } from "@my-flux/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Eye,
  FileJson,
  Send,
  ShieldCheck,
  TriangleAlert,
  Upload,
  Users
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  AvisoTemporario,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  TituloDePagina
} from "../../components/ui";
import { useUsuarioAtual } from "../../features/auth/use-usuario-atual";
import { ApiError } from "../../features/my-flux/client";
import { PainelDeLote } from "./config-lote";
import { nomeDoPublico, PainelDeQuantidades, PainelDeRegras } from "./config-regras";
import {
  apiDosTreinamentos,
  type CenarioDaLista,
  type ProblemaDeAutoria,
  type ValidacaoDoCenario,
  type VersaoDaLista
} from "../../features/treinamentos/api";
import { PreVisualizacao } from "../../features/treinamentos/pre-visualizacao";

const campo =
  "mt-1 block h-11 w-full rounded-mf-controle border border-mf-linha bg-white px-3 text-sm font-normal";
const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Os exemplos ficam fora do pacote principal: só carregam quando pedidos. */
const exemplos = {
  quadro: () =>
    import("../../../../../packages/shared/src/treinamentos/exemplos/manutencao-quadro-uti.json"),
  plantao: () =>
    import("../../../../../packages/shared/src/treinamentos/exemplos/rh-falta-plantao-noturno.json")
};

function ListaDeProblemas({ problemas }: { problemas: ProblemaDeAutoria[] }) {
  return (
    <div
      role="alert"
      className="mt-3 rounded-mf-controle border border-mf-perigo/20 bg-mf-perigo-suave p-3"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-mf-perigo">
        <TriangleAlert size={16} aria-hidden="true" />
        {problemas.length === 1
          ? "1 problema de autoria"
          : `${problemas.length} problemas de autoria`}
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {problemas.map((p, i) => (
          <li key={i} className="text-mf-texto">
            <code className="rounded bg-white px-1 font-mono text-xs text-mf-perigo">
              {p.caminho}
            </code>{" "}
            {p.mensagem}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TreinamentosConfigPage() {
  const cache = useQueryClient();
  // ADMIN e DEV editam; o RH só lê (a API confere de novo em cada chamada).
  const perfil = useUsuarioAtual().data?.role;
  const podeEditar = perfil === "ADMIN" || perfil === "DEV";
  const cenarios = useQuery({
    queryKey: ["treinamentos", "cenarios"],
    queryFn: apiDosTreinamentos.cenarios,
    retry: false
  });
  const [texto, setTexto] = useState("");
  const [validacao, setValidacao] = useState<ValidacaoDoCenario | null>(null);
  const [erroDoJson, setErroDoJson] = useState("");
  const [destino, setDestino] = useState("novo");
  const [previa, setPrevia] = useState<TreinoCenario | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  // Validação ao vivo: o MESMO schema do servidor (packages/shared), enquanto a pessoa digita.
  const [aoVivo, setAoVivo] = useState<ProblemaDeAutoria[] | null>(null);

  useEffect(() => {
    if (!texto.trim()) {
      setAoVivo(null);
      return;
    }
    const espera = setTimeout(() => {
      try {
        const r = validarCenarioImportado(JSON.parse(texto));
        setAoVivo(r.ok ? [] : r.problemas);
      } catch (e) {
        setAoVivo([
          { caminho: "(JSON)", mensagem: e instanceof Error ? e.message : "JSON inválido." }
        ]);
      }
    }, 350);
    return () => clearTimeout(espera);
  }, [texto]);

  function lerJson(): unknown | undefined {
    setErroDoJson("");
    try {
      return JSON.parse(texto);
    } catch (e) {
      setErroDoJson(`JSON inválido: ${e instanceof Error ? e.message : "confira a sintaxe"}.`);
      return undefined;
    }
  }

  async function validar(evento?: FormEvent) {
    evento?.preventDefault();
    setPrevia(null);
    const conteudo = lerJson();
    if (conteudo === undefined) return setValidacao(null);
    setOcupado(true);
    try {
      const r = await apiDosTreinamentos.validarCenario(conteudo);
      setValidacao(r);
      // Cenário com slug já cadastrado: o caminho natural é uma nova versão dele.
      const existente = cenarios.data?.find((c) => c.slug === r.resumo?.slug);
      setDestino(existente ? existente.id : "novo");
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não foi possível validar.");
    } finally {
      setOcupado(false);
    }
  }

  function preVisualizar(conteudo: unknown) {
    const r = validarCenarioImportado(conteudo);
    if (r.ok) setPrevia(r.cenario);
    else setValidacao({ valido: false, problemas: r.problemas });
  }

  async function salvar() {
    const conteudo = lerJson();
    if (conteudo === undefined) return;
    setOcupado(true);
    try {
      const r =
        destino === "novo"
          ? await apiDosTreinamentos.criarCenario(conteudo)
          : await apiDosTreinamentos.novaVersao(destino, conteudo);
      setAviso(`Salvo como versão ${r.numero}, em rascunho. Revise e aprove para atribuir.`);
      setTexto("");
      setValidacao(null);
      setPrevia(null);
      void cache.invalidateQueries({ queryKey: ["treinamentos", "cenarios"] });
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details.problemas))
        setValidacao({ valido: false, problemas: e.details.problemas as ProblemaDeAutoria[] });
      else setAviso(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setOcupado(false);
    }
  }

  async function carregarArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setTexto(await arquivo.text());
    setValidacao(null);
    setPrevia(null);
  }

  async function carregarExemplo(qual: keyof typeof exemplos) {
    const modulo = await exemplos[qual]();
    setTexto(JSON.stringify(modulo.default, null, 2));
    setValidacao(null);
    setPrevia(null);
  }

  return (
    <div className="space-y-6">
      <TituloDePagina
        etiqueta="MY FLUX · Treinamentos"
        titulo="Configuração de treinamentos"
        descricao={
          podeEditar
            ? "Cadastre cenários em JSON, valide, pré-visualize no Palco, aprove a versão e configure quem recebe cada cenário no teste do Leadership Lab. O conteúdo técnico nasce como rascunho até a validação de segurança do trabalho, RH e jurídico."
            : "Veja os cenários, as regras e as quantidades do teste do Leadership Lab. Só ADMIN e DEV editam; aqui você lê e pré-visualiza."
        }
      />
      <AvisoTemporario mensagem={aviso} aoFechar={() => setAviso("")} />

      {podeEditar ? (
        <form
          onSubmit={(e) => void validar(e)}
          aria-labelledby="enviar-titulo"
          className="rounded-mf-cartao border border-mf-linha bg-mf-cartao p-5 shadow-mf-1"
        >
          <h2
            id="enviar-titulo"
            className="flex items-center gap-2 font-display text-lg font-bold text-mf-tinta"
          >
            <FileJson size={18} aria-hidden="true" className="text-mf-primaria" />
            Enviar um cenário
          </h2>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium text-mf-texto">
              Arquivo .json
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => void carregarArquivo(e.target.files?.[0])}
                className="mt-1 block min-h-11 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-mf-realce-suave file:px-3 file:py-1.5 file:text-mf-primaria"
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              icon={<Upload size={16} />}
              onClick={() => void carregarExemplo("quadro")}
            >
              Exemplo: quadro elétrico
            </Button>
            <Button
              type="button"
              variant="ghost"
              icon={<Upload size={16} />}
              onClick={() => void carregarExemplo("plantao")}
            >
              Exemplo: falta no plantão
            </Button>
          </div>
          <label className="mt-3 block text-sm font-medium text-mf-texto">
            Conteúdo do cenário (JSON)
            <textarea
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setValidacao(null);
                setPrevia(null);
              }}
              spellCheck={false}
              className="mt-1 block h-56 w-full rounded-mf-controle border border-mf-linha bg-white p-3 font-mono text-xs"
            />
          </label>
          {erroDoJson ? (
            <p role="alert" className="mt-2 text-sm text-mf-perigo">
              {erroDoJson}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="submit"
              icon={<ShieldCheck size={16} />}
              disabled={!texto.trim() || ocupado}
            >
              Validar
            </Button>
          </div>

          {aoVivo !== null && aoVivo.length > 0 && !validacao ? (
            <ListaDeProblemas problemas={aoVivo} />
          ) : aoVivo !== null && !validacao ? (
            <p role="status" className="mt-3 flex items-center gap-2 text-sm text-mf-primaria">
              <CheckCircle2 size={16} aria-hidden="true" /> O conteúdo segue o formato (confira com
              Validar antes de salvar).
            </p>
          ) : null}
          {validacao && !validacao.valido ? (
            <ListaDeProblemas problemas={validacao.problemas} />
          ) : null}
          {validacao?.valido && validacao.resumo ? (
            <div className="mt-3 rounded-mf-controle border border-mf-realce bg-mf-realce-suave p-3 text-sm">
              <p className="flex items-center gap-2 font-semibold text-mf-primaria">
                <CheckCircle2 size={16} aria-hidden="true" /> Cenário válido:{" "}
                {validacao.resumo.titulo}
              </p>
              <p className="mt-1 text-mf-texto-2">
                <span className="font-mono">{validacao.resumo.slug}</span> · área{" "}
                {validacao.resumo.area} · pacote{" "}
                <span className="font-mono">{validacao.resumo.scenePack}</span> ·{" "}
                {validacao.resumo.decisoes} decisões, {validacao.resumo.acontecimentos}{" "}
                acontecimentos, {validacao.resumo.resultados} resultados
                {validacao.resumo.exemplo ? " · EXEMPLO" : ""}
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  icon={<Eye size={16} />}
                  onClick={() => preVisualizar(JSON.parse(texto))}
                >
                  Pré-visualizar
                </Button>
                <label className="text-sm font-medium text-mf-texto">
                  Salvar como
                  <select
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                    className={campo}
                  >
                    {cenarios.data?.some((c) => c.slug === validacao.resumo?.slug) ? null : (
                      <option value="novo">Novo cenário</option>
                    )}
                    {(cenarios.data ?? [])
                      .filter((c) => c.slug === validacao.resumo?.slug)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          Nova versão de “{c.titulo}”
                        </option>
                      ))}
                  </select>
                </label>
                <Button
                  type="button"
                  icon={<Send size={16} />}
                  disabled={ocupado}
                  onClick={() => void salvar()}
                >
                  Salvar
                </Button>
              </div>
            </div>
          ) : null}
        </form>
      ) : null}

      {podeEditar ? (
        <PainelDeLote
          cenarios={cenarios.data ?? []}
          aoMudar={(mensagem) => {
            setAviso(mensagem);
            void cache.invalidateQueries({ queryKey: ["treinamentos", "cenarios"] });
          }}
        />
      ) : null}

      <PainelDeRegras podeEditar={podeEditar} />
      <PainelDeQuantidades podeEditar={podeEditar} />

      {previa ? (
        <section
          aria-label="Pré-visualização"
          className="rounded-mf-cartao border border-mf-linha bg-mf-cartao p-4 shadow-mf-1"
        >
          <PreVisualizacao cenario={previa} />
        </section>
      ) : null}

      <section aria-labelledby="cenarios-titulo" className="space-y-3">
        <h2 id="cenarios-titulo" className="font-display text-lg font-bold text-mf-tinta">
          Cenários
        </h2>
        {cenarios.isPending ? (
          <Skeleton className="h-40 rounded-mf-cartao" />
        ) : cenarios.isError ? (
          <ErrorState
            title="Não foi possível carregar os cenários"
            description={cenarios.error.message}
            onRetry={() => void cenarios.refetch()}
          />
        ) : cenarios.data.length === 0 ? (
          <EmptyState
            title="Nenhum cenário cadastrado"
            description="Envie o JSON de um cenário acima (ou carregue um exemplo) para começar."
          />
        ) : (
          cenarios.data.map((c) => (
            <CartaoDoCenario
              key={c.id}
              cenario={c}
              podeEditar={podeEditar}
              aoMudar={(mensagem) => {
                setAviso(mensagem);
                void cache.invalidateQueries({ queryKey: ["treinamentos", "cenarios"] });
              }}
            />
          ))
        )}
      </section>
    </div>
  );
}

function CartaoDoCenario({
  cenario,
  podeEditar,
  aoMudar
}: {
  cenario: CenarioDaLista;
  podeEditar: boolean;
  aoMudar: (mensagem: string) => void;
}) {
  const [previa, setPrevia] = useState<TreinoCenario | null>(null);
  const [atribuindo, setAtribuindo] = useState<VersaoDaLista | null>(null);
  const [erro, setErro] = useState("");

  async function ver(versao: VersaoDaLista) {
    setErro("");
    try {
      const lida = await apiDosTreinamentos.lerVersao(cenario.id, versao.id);
      const r = validarCenario(lida.conteudo);
      if (r.ok) setPrevia(r.cenario);
      else setErro("O conteúdo gravado desta versão não passa na validação atual.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível abrir a versão.");
    }
  }

  async function enviarParaRevisao() {
    setErro("");
    try {
      await apiDosTreinamentos.enviarParaRevisao(cenario.id);
      aoMudar(`“${cenario.titulo}” enviado para revisão.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar para revisão.");
    }
  }

  async function aprovar(versao: VersaoDaLista) {
    if (
      !window.confirm(
        `Aprovar a versão ${versao.numero} de “${cenario.titulo}”?\n\nA versão aprovada fica congelada (não muda mais) e pode ser atribuída a turmas. Confirme que o conteúdo técnico foi validado.`
      )
    )
      return;
    try {
      await apiDosTreinamentos.aprovar(cenario.id, versao.id);
      aoMudar(`Versão ${versao.numero} aprovada.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível aprovar.");
    }
  }

  return (
    <article className="rounded-mf-cartao border border-mf-linha bg-mf-cartao p-5 shadow-mf-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-bold text-mf-tinta">{cenario.titulo}</h3>
          <p className="text-xs text-mf-texto-3">
            <span className="font-mono">{cenario.slug}</span> · {cenario.area} ·{" "}
            {cenario.publico
              ? (nomeDoPublico[cenario.publico as keyof typeof nomeDoPublico] ?? cenario.publico)
              : "sem público"}{" "}
            · alterado em {dataCurta(cenario.alteradoEm)}
          </p>
        </div>
        <span className="flex items-center gap-2">
          {podeEditar && cenario.status === "rascunho" ? (
            <Button size="sm" variant="secondary" onClick={() => void enviarParaRevisao()}>
              Enviar para revisão
            </Button>
          ) : null}
          <Badge
            tone={
              cenario.status === "aprovado"
                ? "success"
                : cenario.status === "em_revisao"
                  ? "warning"
                  : "neutral"
            }
          >
            {cenario.status === "aprovado"
              ? "Aprovado"
              : cenario.status === "rascunho"
                ? "Rascunho"
                : cenario.status === "em_revisao"
                  ? "Em revisão"
                  : cenario.status}
          </Badge>
        </span>
      </div>
      <ul className="mt-3 divide-y divide-mf-linha rounded-mf-controle border border-mf-linha">
        {cenario.versoes.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
            <span className="font-semibold text-mf-tinta">Versão {v.numero}</span>
            <span className="text-xs text-mf-texto-3">
              criada em {dataCurta(v.criadoEm)} · pacote{" "}
              <span className="font-mono">{v.scenePack}</span>
            </span>
            {v.aprovadoEm ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-mf-primaria">
                <CheckCircle2 size={13} aria-hidden="true" /> Aprovada em {dataCurta(v.aprovadoEm)}
              </span>
            ) : (
              <span className="text-xs font-semibold text-mf-alerta">Rascunho</span>
            )}
            <span className="text-xs text-mf-texto-3">
              {v.atribuicoes} {v.atribuicoes === 1 ? "atribuição" : "atribuições"}
            </span>
            <span className="ml-auto flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="ghost"
                icon={<Eye size={14} />}
                onClick={() => void ver(v)}
              >
                Pré-visualizar
              </Button>
              {!podeEditar ? null : v.aprovadoEm ? (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Users size={14} />}
                  onClick={() => setAtribuindo(v)}
                >
                  Atribuir
                </Button>
              ) : (
                <Button size="sm" icon={<CheckCircle2 size={14} />} onClick={() => void aprovar(v)}>
                  Aprovar
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {erro ? (
        <p role="alert" className="mt-2 text-sm text-mf-perigo">
          {erro}
        </p>
      ) : null}
      {atribuindo ? (
        <FormularioDeAtribuicao
          versao={atribuindo}
          aoCancelar={() => setAtribuindo(null)}
          aoAtribuir={(turma) => {
            setAtribuindo(null);
            aoMudar(`Versão ${atribuindo.numero} atribuída à ${turma}.`);
          }}
        />
      ) : null}
      {previa ? (
        <div className="mt-4">
          <PreVisualizacao cenario={previa} />
        </div>
      ) : null}
    </article>
  );
}

function FormularioDeAtribuicao({
  versao,
  aoCancelar,
  aoAtribuir
}: {
  versao: VersaoDaLista;
  aoCancelar: () => void;
  aoAtribuir: (turma: string) => void;
}) {
  const turmas = useQuery({
    queryKey: ["treinamentos", "turmas"],
    queryFn: apiDosTreinamentos.turmas,
    retry: false
  });
  const [turmaId, setTurmaId] = useState("");
  const [prazo, setPrazo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro("");
    setOcupado(true);
    try {
      // Prazo: fim do dia escolhido, em São Paulo.
      await apiDosTreinamentos.atribuir(
        versao.id,
        turmaId,
        prazo ? new Date(`${prazo}T23:59:59-03:00`).toISOString() : null
      );
      aoAtribuir(turmas.data?.find((t) => t.id === turmaId)?.nome ?? "turma");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível atribuir.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void enviar(e)}
      aria-label={`Atribuir a versão ${versao.numero}`}
      className="mt-3 flex flex-wrap items-end gap-3 rounded-mf-controle bg-mf-fundo p-3"
    >
      <label className="text-sm font-medium text-mf-texto">
        Turma
        <select
          required
          value={turmaId}
          onChange={(e) => setTurmaId(e.target.value)}
          className={campo}
        >
          <option value="">{turmas.isPending ? "Carregando..." : "Escolha a turma"}</option>
          {(turmas.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome} · {t.curador} · {t.participantes}{" "}
              {t.participantes === 1 ? "pessoa" : "pessoas"}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-mf-texto">
        Prazo (opcional)
        <input
          type="date"
          value={prazo}
          onChange={(e) => setPrazo(e.target.value)}
          className={campo}
        />
      </label>
      <Button type="submit" disabled={!turmaId || ocupado} icon={<Send size={16} />}>
        Atribuir
      </Button>
      <Button type="button" variant="ghost" onClick={aoCancelar}>
        Cancelar
      </Button>
      {turmas.data && turmas.data.length === 0 ? (
        <p className="w-full text-sm text-mf-texto-2">
          Nenhuma turma ativa. Crie turmas no Leadership Lab.
        </p>
      ) : null}
      {erro ? (
        <p role="alert" className="w-full text-sm text-mf-perigo">
          {erro}
        </p>
      ) : null}
    </form>
  );
}
