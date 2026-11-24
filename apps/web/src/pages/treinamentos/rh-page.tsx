// Treinamentos Interativos — acompanhamento do RH (curador): as tentativas concluídas SÓ das turmas
// ativas dele (o DEV vê todas; quem filtra é a API). Abre o resultado e a análise de cada uma e
// valida com uma nota opcional. Dois curadores ao mesmo tempo: a API deixa um só validar.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TreinoNivel } from "@my-flux/shared";
import { CheckCircle2, CircleAlert, CircleCheck, Eye, OctagonAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AvisoTemporario,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  TituloDePagina
} from "../../components/ui";
import { cn } from "../../lib/cn";
import { ApiError } from "../../features/my-flux/client";
import {
  apiDosTreinamentos,
  type SituacaoDoRh,
  type TentativaDoRh
} from "../../features/treinamentos/api";

const NIVEL: Record<TreinoNivel, { rotulo: string; Icone: typeof CircleCheck; classe: string }> = {
  ok: { rotulo: "Bom", Icone: CircleCheck, classe: "bg-mf-realce-suave text-mf-primaria" },
  warn: { rotulo: "Atenção", Icone: CircleAlert, classe: "bg-mf-alerta-suave text-mf-alerta" },
  bad: { rotulo: "Risco", Icone: OctagonAlert, classe: "bg-mf-perigo-suave text-mf-perigo" }
};
const SITUACOES: { valor: SituacaoDoRh; rotulo: string }[] = [
  { valor: "pendentes", rotulo: "A validar" },
  { valor: "validadas", rotulo: "Validadas" },
  { valor: "todas", rotulo: "Todas" }
];
const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export function TreinamentosRhPage() {
  const [situacao, setSituacao] = useState<SituacaoDoRh>("pendentes");
  const [aviso, setAviso] = useState("");
  const cache = useQueryClient();
  const lista = useQuery({
    queryKey: ["treinamentos", "rh", situacao],
    queryFn: () => apiDosTreinamentos.tentativasDoRh(situacao),
    retry: false
  });

  return (
    <div className="space-y-6">
      <TituloDePagina
        etiqueta="MY FLUX · Treinamentos"
        titulo="Acompanhamento de treinamentos"
        descricao="As tentativas concluídas das suas turmas ativas. Abra o resultado e a análise, e valide com uma nota para a pessoa."
      />
      <AvisoTemporario mensagem={aviso} aoFechar={() => setAviso("")} />
      <div role="tablist" aria-label="Situação" className="flex flex-wrap gap-2">
        {SITUACOES.map((s) => (
          <button
            key={s.valor}
            type="button"
            role="tab"
            aria-selected={situacao === s.valor}
            onClick={() => setSituacao(s.valor)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm font-medium",
              situacao === s.valor
                ? "border-mf-primaria bg-mf-realce-suave text-mf-primaria"
                : "border-mf-linha bg-mf-cartao text-mf-texto-2"
            )}
          >
            {s.rotulo}
          </button>
        ))}
      </div>
      {lista.isPending ? (
        <div role="status" aria-label="Carregando tentativas" className="space-y-2">
          <Skeleton className="h-20 rounded-mf-cartao" />
          <Skeleton className="h-20 rounded-mf-cartao" />
        </div>
      ) : lista.isError ? (
        <ErrorState
          title="Não foi possível carregar as tentativas"
          description={lista.error.message}
          onRetry={() => void lista.refetch()}
        />
      ) : lista.data.length === 0 ? (
        <EmptyState
          title={situacao === "pendentes" ? "Nada a validar agora" : "Nenhuma tentativa por aqui"}
          description="Aparecem aqui as tentativas concluídas pelos participantes das suas turmas ativas."
        />
      ) : (
        <ul className="space-y-3">
          {lista.data.map((t) => (
            <ItemDoRh
              key={t.tentativaId}
              tentativa={t}
              aoValidar={(mensagem) => {
                setAviso(mensagem);
                void cache.invalidateQueries({ queryKey: ["treinamentos", "rh"] });
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemDoRh({
  tentativa: t,
  aoValidar
}: {
  tentativa: TentativaDoRh;
  aoValidar: (mensagem: string) => void;
}) {
  const [validando, setValidando] = useState(false);
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function validar(evento: FormEvent) {
    evento.preventDefault();
    setErro("");
    setOcupado(true);
    try {
      await apiDosTreinamentos.validarTentativa(t.tentativaId, nota);
      aoValidar(`Tentativa de ${t.participante} validada.`);
      setValidando(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === "TREINO_JA_VALIDADA") {
        aoValidar("Outro curador já validou esta tentativa. A lista foi atualizada.");
        setValidando(false);
      } else setErro(e instanceof Error ? e.message : "Não foi possível validar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <li className="rounded-mf-cartao border border-mf-linha bg-mf-cartao p-4 shadow-mf-1">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-mf-tinta">{t.participante}</p>
          <p className="text-sm text-mf-texto-2">
            {t.titulo} · {t.turma}
            {t.concluidaEm ? ` · concluído em ${dataCurta(t.concluidaEm)}` : ""}
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Resultados">
            {t.resultados.map((r) => {
              const { rotulo, Icone, classe } = NIVEL[r.nivel];
              return (
                <li
                  key={r.id}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    classe
                  )}
                >
                  <Icone size={12} aria-hidden="true" />
                  {r.label}: {rotulo}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {t.validada ? (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-mf-primaria">
              <CheckCircle2 size={16} aria-hidden="true" /> Validada
            </span>
          ) : null}
          <Link
            to={`/treinamentos/resultado/${t.tentativaId}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-mf-controle px-3 text-sm font-semibold text-mf-primaria hover:bg-mf-realce-suave"
          >
            <Eye size={16} aria-hidden="true" /> Ver resultado
            <span className="sr-only"> de {t.participante}</span>
          </Link>
          {!t.validada && !validando ? (
            <Button size="sm" onClick={() => setValidando(true)}>
              Validar<span className="sr-only"> a tentativa de {t.participante}</span>
            </Button>
          ) : null}
        </div>
      </div>
      {validando ? (
        <form
          onSubmit={(e) => void validar(e)}
          className="mt-3 space-y-2 rounded-mf-controle bg-mf-fundo p-3"
        >
          <label className="block text-sm font-medium text-mf-texto">
            Nota para a pessoa (opcional)
            <textarea
              value={nota}
              maxLength={2000}
              onChange={(e) => setNota(e.target.value)}
              className="mt-1 block h-20 w-full rounded-mf-controle border border-mf-linha bg-white p-2 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={ocupado} aria-busy={ocupado}>
              Confirmar validação
            </Button>
            <Button type="button" variant="ghost" onClick={() => setValidando(false)}>
              Cancelar
            </Button>
          </div>
          {erro ? (
            <p role="alert" className="text-sm text-mf-perigo">
              {erro}
            </p>
          ) : null}
        </form>
      ) : null}
    </li>
  );
}
