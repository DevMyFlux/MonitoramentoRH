// Leadership Lab — o resultado de um teste por cenários. Mostra o que o servidor calculou: a aderência
// (decisões cumpridas), a agilidade, o resumo e, por cenário, as 3 saídas, as 5 decisões (cumprida ou
// não, com o procedimento de referência) e o que a pessoa escolheu em cada pergunta. O gabarito só
// aparece aqui, depois de concluir.
import type { LabResultadoDosCenarios } from "@my-flux/shared";
import { ArrowLeft, Check, X } from "lucide-react";
import {
  Badge,
  BotaoLink,
  CabecalhoDePagina,
  Escalonar,
  Expansivel,
  NumeroAnimado,
  Revelar
} from "../ui";
import { formatarDataEHora, formatarNumero, nomeDoNivelDoCenario, nomeDoPublico } from "../rotulos";
import { Cartao, Estatistica } from "./cartao";
import { ContestarResultado } from "./contestar-resultado";
import { SeloDeValidacao } from "./selo-de-validacao";

const comoPorcentagem = (n: number) => `${formatarNumero(n)}%`;

const tomDoNivel = { ok: "success", warn: "warning", bad: "danger" } as const;

export function ResultadoDosCenarios({ resultado }: { resultado: LabResultadoDosCenarios }) {
  const decisoes = resultado.cenarios.flatMap((c) => c.decisoes);
  const cumpridas = decisoes.filter((d) => d.cumpriu).length;
  return (
    <Escalonar className="mx-auto max-w-4xl space-y-8">
      <Revelar>
        <CabecalhoDePagina
          eyebrow="Leadership Lab"
          titulo="Resultado do teste"
          acao={<SeloDeValidacao status={resultado.statusValidacao} />}
        >
          <p className="mt-3 text-lab-pequeno text-lab-tinta">
            {nomeDoPublico[resultado.publico] ?? resultado.publico} · {resultado.cenarios.length}{" "}
            {resultado.cenarios.length === 1 ? "cenário" : "cenários"}
          </p>
          {resultado.concluidaEm ? (
            <p className="mt-1.5 text-lab-pequeno text-lab-tinta-2">
              Concluído em {formatarDataEHora(resultado.concluidaEm)}
            </p>
          ) : null}
        </CabecalhoDePagina>
      </Revelar>

      {resultado.origem === "interno" ? (
        <Revelar>
          <p
            role="note"
            className="rounded-lab-lg border border-lab-info/20 bg-lab-info-suave p-4 text-lab-pequeno leading-6 text-lab-info-texto"
          >
            <strong className="font-semibold">Teste interno.</strong> Ele serve para validar e
            demonstrar: não entra nos números nem nas comparações dos participantes.
          </p>
        </Revelar>
      ) : resultado.statusValidacao === "aguardando_validacao" ? (
        <Revelar>
          <p
            role="note"
            className="rounded-lab-lg border border-lab-aviso/20 bg-lab-aviso-suave p-4 text-lab-pequeno leading-6 text-lab-aviso-texto"
          >
            Este resultado ainda será validado pelo RH. Só depois disso ele passa a fazer parte do
            seu histórico oficial.
          </p>
        </Revelar>
      ) : null}

      {resultado.experimental ? (
        <Revelar>
          <p
            role="note"
            className="rounded-lab-lg border border-lab-info/20 bg-lab-info-suave p-4 text-lab-pequeno leading-6 text-lab-info-texto"
          >
            <strong className="font-semibold">Resultado experimental.</strong> Os cenários deste
            teste ainda têm textos de exemplo, em validação pelas áreas responsáveis. Use-o para se
            desenvolver; ele não vale como avaliação oficial.
          </p>
        </Revelar>
      ) : null}

      <section aria-label="Números do teste" className="grid gap-4 sm:grid-cols-3">
        <Estatistica
          rotulo="Aderência geral"
          valor={<NumeroAnimado valor={resultado.aderenciaGeral} formatar={comoPorcentagem} />}
          anel={{ valor: resultado.aderenciaGeral }}
          detalhe={`${cumpridas} de ${decisoes.length} decisões cumpridas`}
        />
        <Estatistica
          rotulo="Agilidade"
          valor={<NumeroAnimado valor={resultado.agilidade} formatar={comoPorcentagem} />}
          anel={{ valor: resultado.agilidade, tom: "info" }}
          detalhe="Quão rápido você decidiu"
        />
        <Estatistica rotulo="Cenários" valor={resultado.cenarios.length} />
      </section>

      <Cartao titulo="Resumo">
        <p className="text-lab-corpo leading-7 text-lab-tinta">{resultado.resumo}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {resultado.pontoForte ? (
            <div className="rounded-lab-md bg-lab-sucesso-suave p-5">
              <p className="text-lab-legenda font-semibold text-lab-sucesso-texto">Ponto forte</p>
              <p className="mt-1.5 text-lab-pequeno leading-6 text-lab-tinta">
                {resultado.pontoForte}
              </p>
            </div>
          ) : null}
          {resultado.pontoDesenvolvimento ? (
            <div className="rounded-lab-md bg-lab-aviso-suave p-5">
              <p className="text-lab-legenda font-semibold text-lab-aviso-texto">
                Ponto a desenvolver
              </p>
              <p className="mt-1.5 text-lab-pequeno leading-6 text-lab-tinta">
                {resultado.pontoDesenvolvimento}
              </p>
            </div>
          ) : null}
        </div>
        {resultado.sugestoes.length > 0 ? (
          <ul className="mt-5 list-disc space-y-1 pl-5 text-lab-pequeno leading-6 text-lab-tinta">
            {resultado.sugestoes.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ) : null}
      </Cartao>

      {resultado.cenarios.map((c) => (
        <Cartao key={c.ordem} titulo={`Cenário ${c.ordem}: ${c.titulo}`}>
          {c.exemplo ? (
            <p className="mb-3 text-lab-legenda text-lab-tinta-2">
              Texto de exemplo, ainda em validação técnica.
            </p>
          ) : null}
          <ul className="space-y-2" aria-label={`Resultados do cenário ${c.ordem}`}>
            {c.desfecho.outcomes.map((o) => (
              <li key={o.id} className="rounded-lab-md border border-lab-borda p-4">
                <p className="flex flex-wrap items-center gap-2 text-lab-pequeno font-semibold text-lab-tinta">
                  {o.label}
                  <Badge tone={tomDoNivel[o.nivel]}>{nomeDoNivelDoCenario[o.nivel]}</Badge>
                </p>
                <p className="mt-1 text-lab-pequeno leading-6 text-lab-tinta-2">{o.texto}</p>
              </li>
            ))}
          </ul>

          <h3 className="mt-5 text-lab-pequeno font-semibold text-lab-tinta">As 5 decisões</h3>
          <ul className="mt-2 space-y-1.5">
            {c.decisoes.map((d) => (
              <li key={d.id} className="flex items-start gap-2 text-lab-pequeno text-lab-tinta">
                {d.cumpriu ? (
                  <Check
                    size={16}
                    aria-label="Cumprida"
                    className="mt-0.5 shrink-0 text-lab-sucesso-texto"
                  />
                ) : (
                  <X
                    size={16}
                    aria-label="Não cumprida"
                    className="mt-0.5 shrink-0 text-lab-perigo-texto"
                  />
                )}
                <span>
                  {d.label}
                  <span className="text-lab-tinta-2"> — {d.procedure}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4">
            <Expansivel cabecalho="O que você escolheu em cada pergunta">
              <ol className="space-y-3">
                {c.respostas.map((r) => (
                  <li key={r.perguntaId} className="text-lab-pequeno leading-6 text-lab-tinta">
                    <p className="font-medium">{r.prompt}</p>
                    <p className="text-lab-tinta-2">Sua escolha: {r.texto}</p>
                    <p className="text-lab-tinta-2">
                      {r.reacao.title}. {r.reacao.text}
                    </p>
                  </li>
                ))}
              </ol>
            </Expansivel>
          </div>
        </Cartao>
      ))}

      {resultado.origem === "participante" ? (
        <ContestarResultado
          resultado={{ resultadoId: resultado.resultadoId }}
          pontos={resultado.cenarios.map((c) => `Cenário ${c.ordem}: ${c.titulo}`)}
        />
      ) : null}

      <div>
        <BotaoLink to="/lab" variant="secondary" icon={<ArrowLeft size={16} aria-hidden="true" />}>
          Voltar ao painel
        </BotaoLink>
      </div>
    </Escalonar>
  );
}
