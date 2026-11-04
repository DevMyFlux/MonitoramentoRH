import {
  type LabContestacaoPropria,
  type LabResultado,
  labCriarContestacaoEntradaSchema,
  labLimitesDeTexto
} from "@my-flux/shared";
import { useState } from "react";
import { Badge, Button } from "../../../components/ui";
import { useContestar, useMinhasContestacoes } from "../curadoria-hooks";
import { descreverErro } from "../erros";
import { formatarDataEHora } from "../rotulos";
import { Cartao } from "./cartao";

const PONTO_GERAL = "Resultado geral";

const rotuloDoStatus = {
  pendente: "Em análise",
  aceita: "Aceita",
  rejeitada: "Rejeitada"
} as const;
const tomDoStatus = { pendente: "warning", aceita: "success", rejeitada: "neutral" } as const;

/**
 * O participante questiona um ponto do próprio resultado. O RH da turma analisa e responde, e a
 * resposta aparece aqui, com a nota, mas sem o nome de quem decidiu.
 */
export function ContestarResultado({ resultado }: { resultado: LabResultado }) {
  const minhas = useMinhasContestacoes(resultado.resultadoId);
  const contestar = useContestar(resultado.resultadoId);
  const [ponto, setPonto] = useState(PONTO_GERAL);
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);

  const pontos = [
    PONTO_GERAL,
    ...resultado.situacoes.map((s) => `Situação ${s.numero}`),
    ...resultado.niveisPorSkill.map((s) => `Nível de ${s.nome}`)
  ];

  const enviar = () => {
    setEnviada(false);
    const lido = labCriarContestacaoEntradaSchema.safeParse({ ponto, motivo });
    if (!lido.success) {
      setAviso("Conte o motivo: diga o que você discorda e por quê.");
      return;
    }
    setAviso(null);
    contestar.mutate(lido.data, {
      onSuccess: () => {
        setMotivo("");
        setPonto(PONTO_GERAL);
        setEnviada(true);
      }
    });
  };

  return (
    <Cartao
      titulo="Discorda de algum ponto?"
      descricao="Conte ao RH o que você questiona. O responsável pela sua turma analisa e responde aqui."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <div className="grid gap-2 text-sm font-medium text-slate-700">
          <label htmlFor="ponto-da-contestacao">O que você contesta</label>
          <select
            id="ponto-da-contestacao"
            className="h-12 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-950 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
            value={ponto}
            onChange={(e) => setPonto(e.target.value)}
          >
            {pontos.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2 text-sm font-medium text-slate-700">
          <label htmlFor="motivo-da-contestacao">Por quê</label>
          <textarea
            id="motivo-da-contestacao"
            rows={4}
            maxLength={labLimitesDeTexto.motivo}
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <span className="text-xs font-normal text-slate-500">
            {motivo.length}/{labLimitesDeTexto.motivo}. Só o RH da sua turma lê.
          </span>
        </div>
        {aviso ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {aviso}
          </p>
        ) : null}
        {contestar.isError ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {descreverErro(contestar.error).descricao}
          </p>
        ) : null}
        {enviada ? (
          <p role="status" className="text-sm text-emerald-800">
            Contestação enviada. O RH vai analisar e a resposta aparece aqui embaixo.
          </p>
        ) : null}
        <Button type="submit" disabled={contestar.isPending}>
          {contestar.isPending ? "Enviando..." : "Enviar contestação"}
        </Button>
      </form>

      {minhas.isError ? (
        <p role="alert" className="mt-5 text-sm text-red-700">
          Não foi possível carregar as suas contestações agora. Atualize a página.
        </p>
      ) : minhas.data && minhas.data.length > 0 ? (
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-950">Suas contestações</h3>
          <ul className="space-y-3">
            {minhas.data.map((c) => (
              <ContestacaoPropria key={c.id} contestacao={c} />
            ))}
          </ul>
        </div>
      ) : null}
    </Cartao>
  );
}

function ContestacaoPropria({ contestacao: c }: { contestacao: LabContestacaoPropria }) {
  return (
    <li className="rounded-lg border border-slate-200 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={tomDoStatus[c.status]}>{rotuloDoStatus[c.status]}</Badge>
        <span className="font-medium text-slate-900">{c.ponto}</span>
        <span className="text-xs text-slate-500">{formatarDataEHora(c.criadoEm)}</span>
      </div>
      <p className="mt-2 leading-6 text-slate-700">{c.motivo}</p>
      {c.nota ? (
        <p className="mt-2 border-l-2 border-slate-200 pl-3 leading-6 text-slate-600">
          <span className="font-medium text-slate-800">Resposta do RH:</span> {c.nota}
        </p>
      ) : null}
    </li>
  );
}
