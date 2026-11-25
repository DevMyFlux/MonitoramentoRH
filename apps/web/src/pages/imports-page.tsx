// Importações em três etapas: enviar o arquivo, conferir o que o servidor achou linha a linha e só
// então confirmar. Nada entra no cadastro antes do "Confirmar". A validação, o escopo e a recusa
// (lote com erro, tipo ainda não efetivado, lote de outra pessoa) são da API (/imports).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, FileSpreadsheet, OctagonAlert, RefreshCw, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  AvisoTemporario,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  TituloDePagina
} from "../components/ui";
import { LinhaDeEtapas } from "../components/ui/linha-de-etapas";
import {
  conferir,
  LIMITE_DO_ARQUIVO_BYTES,
  lerComoBase64,
  type ProblemaDaImportacao
} from "../features/importacoes/conferencia";
import { request, text, type Row } from "../features/my-flux/client";
import { labels } from "../features/my-flux/resources";

type Lote = Row & {
  type: string;
  status: string;
  fileName: string;
  acceptedCount: number;
  rejectedCount: number;
  createdAt: string;
  issues?: ProblemaDaImportacao[];
};

const tipos = [
  { valor: "EMPLOYEES", rotulo: "Colaboradores" },
  { valor: "SCHEDULE", rotulo: "Escala" }
];
const rotuloDoTipo = (tipo: string) => tipos.find((t) => t.valor === tipo)?.rotulo ?? tipo;
const etapas = [
  { id: "enviar", rotulo: "Enviar" },
  { id: "conferir", rotulo: "Conferir" },
  { id: "confirmar", rotulo: "Confirmar" }
];
const MAX_LINHAS_VISIVEIS = 30;

export function ImportsPage() {
  const cache = useQueryClient();
  const [etapa, setEtapa] = useState(0);
  const [tipo, setTipo] = useState("EMPLOYEES");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [lote, setLote] = useState<Lote | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [todasAsLinhas, setTodasAsLinhas] = useState(false);

  const historico = useQuery({
    queryKey: ["importacoes"],
    queryFn: () => request<Lote[]>("/imports"),
    retry: false
  });
  const lotes = Array.isArray(historico.data) ? historico.data : [];

  const conferencia = lote ? conferir(lote.type, lote.status, lote.issues ?? []) : null;

  function recomecar() {
    setEtapa(0);
    setLote(null);
    setArquivo(null);
    setErro("");
    setTodasAsLinhas(false);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro("");
    if (!arquivo) return setErro("Escolha um arquivo .xlsx ou .csv.");
    if (arquivo.size > LIMITE_DO_ARQUIVO_BYTES)
      return setErro(
        "Arquivo grande demais para um envio (até ~700 KB). Divida a planilha e envie em partes."
      );
    setOcupado(true);
    try {
      const contentBase64 = await lerComoBase64(arquivo);
      const novo = await request<Lote>("/imports", "POST", {
        type: tipo,
        fileName: arquivo.name,
        contentBase64,
        mapping: {}
      });
      setLote(novo);
      setEtapa(1);
      void cache.invalidateQueries({ queryKey: ["importacoes"] });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o arquivo.");
    } finally {
      setOcupado(false);
    }
  }

  async function rever(id: string) {
    setOcupado(true);
    setErro("");
    try {
      const existente = await request<Lote>(`/imports/${id}`);
      setLote(existente);
      setTipo(existente.type);
      setEtapa(existente.status === "COMMITTED" ? 3 : 1);
      setTodasAsLinhas(false);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não foi possível abrir este lote.");
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    if (!lote) return;
    setOcupado(true);
    setErro("");
    try {
      const resultado = await request<{ committedRows: number }>(
        `/imports/${lote.id}/commit`,
        "POST",
        {}
      );
      setLote({ ...lote, status: "COMMITTED" });
      setEtapa(3);
      setAviso(
        `Importação confirmada: ${resultado.committedRows} ${resultado.committedRows === 1 ? "registro criado" : "registros criados"} e auditados.`
      );
      void cache.invalidateQueries({ queryKey: ["importacoes"] });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "A importação não pôde ser confirmada.");
    } finally {
      setOcupado(false);
    }
  }

  const campo =
    "mt-1 block h-11 w-full rounded-mf-controle border border-mf-linha bg-white/80 px-3 text-sm font-normal";

  return (
    <div className="space-y-6">
      <TituloDePagina
        etiqueta="MY FLUX · Gestão"
        titulo="Importações"
        descricao="Envie a planilha, confira o que o sistema encontrou linha a linha e só então confirme. Nada entra no cadastro antes da confirmação."
        acoes={
          <Button
            variant="ghost"
            icon={<RefreshCw size={16} />}
            onClick={() => void historico.refetch()}
          >
            Atualizar
          </Button>
        }
      />
      <AvisoTemporario mensagem={aviso} aoFechar={() => setAviso("")} />

      <section
        aria-label="Nova importação"
        className="rounded-mf-cartao border border-mf-linha bg-mf-cartao p-5 shadow-mf-1 sm:p-6"
      >
        <LinhaDeEtapas rotulo="Etapas da importação" etapas={etapas} atual={etapa} compacta />

        {erro ? (
          <p
            role="alert"
            className="mt-5 rounded-mf-controle border border-mf-perigo/20 bg-mf-perigo-suave p-3 text-sm text-mf-perigo"
          >
            {erro}
          </p>
        ) : null}

        {etapa === 0 ? (
          <form onSubmit={enviar} className="mt-6 flex flex-wrap items-end gap-4">
            <label className="w-full text-sm font-medium text-mf-texto sm:w-52">
              O que você vai importar
              <select className={campo} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {tipos.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.rotulo}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 flex-1 basis-64 text-sm font-medium text-mf-texto">
              Arquivo (.xlsx ou .csv)
              <input
                type="file"
                accept=".xlsx,.csv"
                className="mt-1 block min-h-11 w-full rounded-mf-controle border border-dashed border-mf-linha bg-mf-fundo px-3 py-2 text-sm font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-mf-realce-suave file:px-3 file:py-1.5 file:font-medium file:text-mf-primaria"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
            </label>
            <Button
              type="submit"
              icon={<Upload size={16} />}
              disabled={ocupado || !arquivo}
              aria-busy={ocupado}
            >
              {ocupado ? "Enviando..." : "Enviar para conferência"}
            </Button>
          </form>
        ) : null}

        {etapa >= 1 && lote && conferencia ? (
          <div className="mt-6 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <FileSpreadsheet size={18} aria-hidden="true" className="text-mf-primaria" />
              <p className="font-semibold text-mf-tinta">{lote.fileName}</p>
              <Badge tone="info">{rotuloDoTipo(lote.type)}</Badge>
              <Badge tone={lote.status === "COMMITTED" ? "success" : "neutral"}>
                {labels[lote.status] ?? lote.status}
              </Badge>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { rotulo: "Linhas aceitas", valor: lote.acceptedCount },
                { rotulo: "Linhas rejeitadas", valor: lote.rejectedCount },
                { rotulo: "Erros", valor: conferencia.erros },
                { rotulo: "Avisos", valor: conferencia.avisos }
              ].map((item) => (
                <div key={item.rotulo} className="rounded-mf-controle bg-mf-fundo p-3">
                  <dt className="text-xs text-mf-texto-2">{item.rotulo}</dt>
                  <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-mf-tinta">
                    {item.valor}
                  </dd>
                </div>
              ))}
            </dl>

            {etapa === 1 ? (
              <>
                {conferencia.porLinha.length === 0 ? (
                  <p className="rounded-mf-controle bg-mf-realce-suave p-3 text-sm text-mf-primaria">
                    Nenhum problema encontrado no arquivo.
                  </p>
                ) : (
                  <div>
                    <h2 className="mb-2 text-sm font-semibold text-mf-tinta">
                      O que precisa de atenção, linha a linha
                    </h2>
                    <ul className="divide-y divide-mf-linha rounded-mf-controle border border-mf-linha">
                      {(todasAsLinhas
                        ? conferencia.porLinha
                        : conferencia.porLinha.slice(0, MAX_LINHAS_VISIVEIS)
                      ).map((grupo) => (
                        <li key={grupo.linha ?? "arquivo"} className="p-3">
                          <p className="font-mono text-xs font-semibold text-mf-texto-2">
                            {grupo.linha === null ? "Arquivo" : `Linha ${grupo.linha}`}
                          </p>
                          <ul className="mt-1 space-y-1">
                            {grupo.problemas.map((problema, i) => (
                              <li key={problema.id ?? i} className="flex gap-2 text-sm">
                                {problema.severity === "ERROR" ? (
                                  <OctagonAlert
                                    size={15}
                                    aria-hidden="true"
                                    className="mt-0.5 shrink-0 text-mf-perigo"
                                  />
                                ) : (
                                  <CircleAlert
                                    size={15}
                                    aria-hidden="true"
                                    className="mt-0.5 shrink-0 text-mf-alerta"
                                  />
                                )}
                                <span>
                                  <strong
                                    className={
                                      problema.severity === "ERROR"
                                        ? "text-mf-perigo"
                                        : "text-mf-alerta"
                                    }
                                  >
                                    {problema.severity === "ERROR" ? "Erro" : "Aviso"}
                                  </strong>
                                  {problema.field ? (
                                    <span className="text-mf-texto-2"> · {problema.field}</span>
                                  ) : null}
                                  : <span className="text-mf-texto">{problema.message}</span>
                                  {problema.value ? (
                                    <span className="ml-1 font-mono text-xs text-mf-texto-3">
                                      ({problema.value})
                                    </span>
                                  ) : null}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                    {!todasAsLinhas && conferencia.porLinha.length > MAX_LINHAS_VISIVEIS ? (
                      <Button
                        className="mt-2"
                        variant="ghost"
                        onClick={() => setTodasAsLinhas(true)}
                      >
                        Mostrar todas as {conferencia.porLinha.length} linhas
                      </Button>
                    ) : null}
                  </div>
                )}
                {conferencia.bloqueio ? (
                  <p className="rounded-mf-controle border border-mf-alerta/25 bg-mf-alerta-suave p-3 text-sm text-mf-alerta">
                    {conferencia.bloqueio}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={recomecar}>
                    Enviar outro arquivo
                  </Button>
                  <Button disabled={Boolean(conferencia.bloqueio)} onClick={() => setEtapa(2)}>
                    Seguir para confirmar
                  </Button>
                </div>
              </>
            ) : null}

            {etapa === 2 ? (
              <div className="space-y-4">
                <p className="text-sm text-mf-texto">
                  Ao confirmar, o sistema cria{" "}
                  <strong className="tabular-nums">{lote.acceptedCount}</strong>{" "}
                  {lote.acceptedCount === 1 ? "colaborador" : "colaboradores"} com histórico de
                  importação, e a ação fica na auditoria. Não dá para desfazer em lote.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setEtapa(1)} disabled={ocupado}>
                    Voltar à conferência
                  </Button>
                  <Button onClick={() => void confirmar()} disabled={ocupado} aria-busy={ocupado}>
                    {ocupado ? "Confirmando..." : "Confirmar importação"}
                  </Button>
                </div>
              </div>
            ) : null}

            {etapa === 3 ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-mf-primaria">Este lote já foi importado.</p>
                <Button variant="secondary" onClick={recomecar}>
                  Nova importação
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section aria-label="Importações anteriores" className="space-y-3">
        <h2 className="font-display text-lg font-bold text-mf-tinta">Importações anteriores</h2>
        {historico.isPending ? (
          <div role="status" aria-label="Carregando importações" className="space-y-2">
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} className="h-14 rounded-mf-controle" />
            ))}
          </div>
        ) : historico.isError ? (
          <ErrorState
            title="Não foi possível carregar as importações"
            description={historico.error.message}
            onRetry={() => void historico.refetch()}
          />
        ) : lotes.length === 0 ? (
          <EmptyState
            title="Nenhuma importação por aqui"
            description="Os lotes que você enviar aparecem aqui, com o que foi aceito e rejeitado."
          />
        ) : (
          <ul className="divide-y divide-mf-linha overflow-hidden rounded-mf-cartao border border-mf-linha bg-mf-cartao shadow-mf-1">
            {lotes.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-mf-tinta">{text(item.fileName)}</p>
                  <p className="text-xs text-mf-texto-3">
                    {rotuloDoTipo(item.type)} ·{" "}
                    {new Date(item.createdAt).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo"
                    })}
                  </p>
                </div>
                <span className="text-xs tabular-nums text-mf-texto-2">
                  {item.acceptedCount} aceitas · {item.rejectedCount} rejeitadas
                </span>
                <Badge tone={item.status === "COMMITTED" ? "success" : "neutral"}>
                  {labels[item.status] ?? item.status}
                </Badge>
                <Button size="sm" variant="ghost" onClick={() => void rever(item.id)}>
                  {item.status === "COMMITTED" ? "Ver" : "Rever"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
