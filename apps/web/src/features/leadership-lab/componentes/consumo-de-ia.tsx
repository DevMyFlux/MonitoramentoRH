import type { LabConsumoDeIa } from "@my-flux/shared";
import { useConsumoDeIa } from "../cadastro-hooks";
import {
  classeDaSuperficie,
  NumeroAnimado,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow
} from "../ui";
import { cn } from "../../../lib/cn";

const NOMES: Record<string, string> = {
  agente_lab: "Treinamento (situações)",
  analista: "Analista (debriefing)",
  facilitador: "Facilitador (conversa)",
  guarda: "Guarda (texto livre)"
};

const inteiro = (n: number) => n.toLocaleString("pt-BR");
const dolar = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

/** Consumo e custo da IA nos últimos dias. Só agregados técnicos: nenhum dado de pessoa. */
export function ConsumoDeIa() {
  const consumo = useConsumoDeIa();
  return (
    <section aria-labelledby="consumo-de-ia" className={cn(classeDaSuperficie, "space-y-5 p-6")}>
      <div>
        <h2 id="consumo-de-ia" className="text-lg font-semibold text-lab-tinta">
          Consumo de IA
        </h2>
        <p className="text-lab-pequeno text-lab-tinta-2">
          Chamadas, tokens e tempo de resposta por agente. Nenhum conteúdo de conversa é guardado.
        </p>
      </div>
      {consumo.isPending ? (
        <Skeleton className="h-24" />
      ) : consumo.isError ? (
        <p role="status" className="text-lab-pequeno text-lab-tinta-2">
          Não foi possível carregar o consumo agora.
        </p>
      ) : (
        <Conteudo consumo={consumo.data} />
      )}
    </section>
  );
}

function Conteudo({ consumo }: { consumo: LabConsumoDeIa }) {
  const custo = consumo.custoEstimadoUsd;
  const indicadores = [
    {
      rotulo: `Testes concluídos (${consumo.dias} dias)`,
      valor: consumo.testesConcluidos,
      formatar: inteiro
    },
    { rotulo: "Tokens por teste (média)", valor: consumo.tokensPorTeste, formatar: inteiro },
    { rotulo: "Custo por teste (estimado)", valor: custo?.porTeste ?? null, formatar: dolar },
    { rotulo: "Custo no período (estimado)", valor: custo?.total ?? null, formatar: dolar }
  ];
  return (
    <>
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {indicadores.map((i) => (
          <div key={i.rotulo}>
            <dt className="text-lab-legenda text-lab-tinta-2">{i.rotulo}</dt>
            <dd className="text-2xl font-semibold tabular-nums text-lab-tinta">
              {i.valor === null ? "—" : <NumeroAnimado valor={i.valor} formatar={i.formatar} />}
            </dd>
          </div>
        ))}
      </dl>
      {custo === null ? (
        <p className="text-lab-pequeno text-lab-tinta-2">
          Custo não estimado: o preço por milhão de tokens ainda não foi configurado no servidor.
        </p>
      ) : null}
      {consumo.agentes.length === 0 ? (
        <p className="text-lab-pequeno text-lab-tinta-2">Nenhuma chamada à IA no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Agente</TableHeaderCell>
                <TableHeaderCell>Chamadas</TableHeaderCell>
                <TableHeaderCell>Falhas</TableHeaderCell>
                <TableHeaderCell>Tokens de entrada</TableHeaderCell>
                <TableHeaderCell>Tokens de saída</TableHeaderCell>
                <TableHeaderCell>Resposta média</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {consumo.agentes.map((a) => (
                <TableRow key={a.agente}>
                  <TableCell>{NOMES[a.agente] ?? a.agente}</TableCell>
                  <TableCell>{inteiro(a.chamadas)}</TableCell>
                  <TableCell>{inteiro(a.falhas)}</TableCell>
                  <TableCell>{inteiro(a.tokensEntrada)}</TableCell>
                  <TableCell>{inteiro(a.tokensSaida)}</TableCell>
                  <TableCell>
                    {(a.latenciaMediaMs / 1000).toLocaleString("pt-BR", {
                      maximumFractionDigits: 1
                    })}{" "}
                    s
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
