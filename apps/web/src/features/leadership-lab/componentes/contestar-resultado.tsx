import {
  type LabContestacaoPropria,
  type LabResultado,
  labCriarContestacaoEntradaSchema,
  labLimitesDeTexto
} from "@my-flux/shared";
import { useState } from "react";
import { Badge, Button, Select, Textarea } from "../ui";
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
        <Select
          id="ponto-da-contestacao"
          label="O que você contesta"
          value={ponto}
          onChange={(e) => setPonto(e.target.value)}
          options={pontos.map((p) => ({ label: p, value: p }))}
        />
        <div className="grid gap-2 text-lab-pequeno font-medium text-lab-tinta">
          <label htmlFor="motivo-da-contestacao">Por quê</label>
          <Textarea
            id="motivo-da-contestacao"
            rows={4}
            maxLength={labLimitesDeTexto.motivo}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <span className="text-lab-legenda font-normal text-lab-tinta-2">
            {motivo.length}/{labLimitesDeTexto.motivo}. Só o RH da sua turma lê.
          </span>
        </div>
        {aviso ? (
          <p
            role="alert"
            className="rounded-lab-md bg-lab-perigo-suave p-3 text-lab-pequeno text-lab-perigo-texto"
          >
            {aviso}
          </p>
        ) : null}
        {contestar.isError ? (
          <p
            role="alert"
            className="rounded-lab-md bg-lab-perigo-suave p-3 text-lab-pequeno text-lab-perigo-texto"
          >
            {descreverErro(contestar.error).descricao}
          </p>
        ) : null}
        {enviada ? (
          <p role="status" className="text-lab-pequeno text-lab-destaque-texto">
            Contestação enviada. O RH vai analisar e a resposta aparece aqui embaixo.
          </p>
        ) : null}
        <Button type="submit" loading={contestar.isPending}>
          {contestar.isPending ? "Enviando..." : "Enviar contestação"}
        </Button>
      </form>

      {minhas.isError ? (
        <p role="alert" className="mt-5 text-lab-pequeno text-lab-perigo-texto">
          Não foi possível carregar as suas contestações agora. Atualize a página.
        </p>
      ) : minhas.data && minhas.data.length > 0 ? (
        <div className="mt-6 space-y-3">
          <h3 className="text-lab-pequeno font-semibold text-lab-tinta">Suas contestações</h3>
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
    <li className="rounded-lab-md border border-lab-linha p-3 text-lab-pequeno">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={tomDoStatus[c.status]}>{rotuloDoStatus[c.status]}</Badge>
        <span className="font-medium text-lab-tinta">{c.ponto}</span>
        <span className="text-lab-legenda text-lab-tinta-2">{formatarDataEHora(c.criadoEm)}</span>
      </div>
      <p className="mt-2 leading-6 text-lab-tinta-2">{c.motivo}</p>
      {c.nota ? (
        <p className="mt-2 border-l-2 border-lab-linha pl-3 leading-6 text-lab-tinta-2">
          <span className="font-medium text-lab-tinta">Resposta do RH:</span> {c.nota}
        </p>
      ) : null}
    </li>
  );
}
