import {
  type LabFichaDeRevisao,
  type LabSituacaoDaFicha,
  labLimitesDeTexto
} from "@my-flux/shared";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  LoadingState,
  Textarea,
  useNotificar
} from "../../../features/leadership-lab/ui";
import { Confirmacao } from "../../../features/leadership-lab/cadastro/confirmacao";
import { LayoutDoAcompanhamento } from "../../../features/leadership-lab/cadastro/layout-do-acompanhamento";
import {
  IdentificacaoDoParticipante,
  SeloDeAlerta,
  SeloDeDecisao
} from "../../../features/leadership-lab/cadastro/situacao-de-curadoria";
import { Cartao, Estatistica } from "../../../features/leadership-lab/componentes/cartao";
import { ErroDaTelaDoLab } from "../../../features/leadership-lab/componentes/erro-da-tela";
import { SeloDeValidacao } from "../../../features/leadership-lab/componentes/selo-de-validacao";
import { useFicha, useValidar } from "../../../features/leadership-lab/curadoria-hooks";
import { descreverErroDoCadastro } from "../../../features/leadership-lab/erros";
import {
  formatarDataEHora,
  formatarNumero,
  nomeDaFlexibilidade,
  nomeDoEstilo,
  nomeDoTipoDeSkill
} from "../../../features/leadership-lab/rotulos";

export function LabFichaPage() {
  const { resultadoId = "" } = useParams();
  const ficha = useFicha(resultadoId);

  return (
    <LayoutDoAcompanhamento>
      <Link
        to="/lab/rh/revisao"
        className="inline-flex items-center gap-1.5 text-lab-pequeno font-medium text-lab-destaque-texto hover:underline"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar à revisão
      </Link>
      {ficha.isPending ? (
        <LoadingState />
      ) : ficha.isError ? (
        <ErroDaTelaDoLab
          erro={descreverErroDoCadastro(ficha.error, "acompanhamento")}
          aoTentarDeNovo={() => void ficha.refetch()}
        />
      ) : (
        <FichaCompleta ficha={ficha.data} />
      )}
    </LayoutDoAcompanhamento>
  );
}

function FichaCompleta({ ficha }: { ficha: LabFichaDeRevisao }) {
  const contestacoesPendentes = ficha.contestacoes.filter((c) => c.status === "pendente").length;
  const alertasAbertos = ficha.alertas.filter((a) => a.status === "aberto").length;

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-lab-lg border border-lab-linha bg-lab-superficie p-5 shadow-lab-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-lab-tinta">
              <IdentificacaoDoParticipante {...ficha.participante} />
            </h2>
            <p className="mt-2 text-lab-pequeno text-lab-tinta-2">
              Teste {ficha.moldeNome} · concluído em {formatarDataEHora(ficha.concluidaEm)}
            </p>
          </div>
          <SeloDeValidacao status={ficha.statusValidacao} />
        </div>
        {ficha.experimental ? (
          <p
            role="note"
            className="rounded-lab-md border border-lab-info/20 bg-lab-info-suave p-3 text-lab-pequeno leading-6 text-lab-info-texto"
          >
            <strong className="font-semibold">Resultado experimental.</strong> Alguma situação deste
            teste não tinha base validada (rubrica ou fontes). Considere o resultado ao decidir a
            validação; ele não deve ser tratado como avaliação oficial.
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-4">
          <Estatistica
            rotulo="Aderência geral"
            valor={`${formatarNumero(ficha.aderenciaGeral)}%`}
          />
          <Estatistica rotulo="Agilidade" valor={`${formatarNumero(ficha.agilidade)}%`} />
          <Estatistica
            rotulo="Estilo predominante"
            valor={ficha.estiloPredominante ? nomeDoEstilo[ficha.estiloPredominante] : "—"}
            detalhe={ficha.estiloPredominante ? undefined : "Empate ou sem escolhas"}
          />
          <Estatistica
            rotulo="Flexibilidade"
            valor={ficha.flexibilidade ? nomeDaFlexibilidade[ficha.flexibilidade] : "—"}
            detalhe={
              ficha.flexibilidadePct === null
                ? undefined
                : `${formatarNumero(ficha.flexibilidadePct)}%`
            }
          />
        </div>
        <p className="text-lab-pequeno leading-6 text-lab-tinta-2">{ficha.resumo}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {ficha.pontoForte ? (
            <p className="rounded-lab-md bg-lab-destaque-suave p-3 text-lab-pequeno text-lab-tinta">
              <span className="block text-lab-legenda font-semibold text-lab-destaque-texto">
                Ponto forte
              </span>
              {ficha.pontoForte}
            </p>
          ) : null}
          {ficha.pontoDesenvolvimento ? (
            <p className="rounded-lab-md bg-lab-aviso-suave p-3 text-lab-pequeno text-lab-tinta">
              <span className="block text-lab-legenda font-semibold text-lab-aviso-texto">
                Ponto de desenvolvimento
              </span>
              {ficha.pontoDesenvolvimento}
            </p>
          ) : null}
        </div>
      </section>

      {contestacoesPendentes > 0 || alertasAbertos > 0 ? (
        <div
          role="note"
          className="space-y-1 rounded-lab-md border border-lab-aviso/20 bg-lab-aviso-suave p-3 text-lab-pequeno text-lab-aviso-texto"
        >
          {contestacoesPendentes > 0 ? (
            <p>
              Há {contestacoesPendentes}{" "}
              {contestacoesPendentes === 1 ? "contestação pendente" : "contestações pendentes"}{" "}
              neste resultado. Leia antes de validar.{" "}
              <Link to="/lab/rh/contestacoes" className="font-medium underline">
                Ir para as contestações
              </Link>
            </p>
          ) : null}
          {alertasAbertos > 0 ? (
            <p>
              Há {alertasAbertos} {alertasAbertos === 1 ? "alerta aberto" : "alertas abertos"} deste
              teste.{" "}
              <Link to="/lab/rh/alertas" className="font-medium underline">
                Ir para os alertas
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      <ValidacaoDoResultado ficha={ficha} />

      <Cartao
        titulo="Situação por situação"
        descricao="O que o participante escolheu e como cada escolha foi avaliada."
      >
        <ol className="space-y-3">
          {ficha.situacoes.map((s) => (
            <SituacaoDaFichaItem key={s.numero} situacao={s} />
          ))}
        </ol>
      </Cartao>

      {ficha.alertas.length > 0 ? (
        <Cartao titulo="Alertas deste teste">
          <ul className="space-y-2 text-lab-pequeno">
            {ficha.alertas.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <SeloDeAlerta cor={a.cor} />
                <span className="text-lab-tinta">
                  {a.skillNome ? a.skillNome : a.situacao ? `Situação ${a.situacao}` : "—"}
                </span>
                <Badge tone={a.status === "aberto" ? "warning" : "neutral"}>
                  {a.status === "aberto" ? "Aberto" : "Encerrado"}
                </Badge>
                {a.nota ? <span className="text-lab-tinta-2">Nota: {a.nota}</span> : null}
              </li>
            ))}
          </ul>
        </Cartao>
      ) : null}

      {ficha.contribuicoes.length > 0 ? (
        <Cartao titulo="Contribuições do participante">
          <ul className="space-y-2 text-lab-pequeno">
            {ficha.contribuicoes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <SeloDeDecisao status={c.status} />
                <span className="text-lab-tinta-2">Situação {c.situacao}:</span>
                <span className="text-lab-tinta">{c.texto}</span>
              </li>
            ))}
          </ul>
        </Cartao>
      ) : null}

      {ficha.contestacoes.length > 0 ? (
        <Cartao titulo="Contestações do participante">
          <ul className="space-y-3 text-lab-pequeno">
            {ficha.contestacoes.map((c) => (
              <li key={c.id} className="rounded-lab-md border border-lab-linha p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SeloDeDecisao status={c.status} />
                  <span className="font-medium text-lab-tinta">{c.ponto}</span>
                </div>
                <p className="mt-2 leading-6 text-lab-tinta-2">{c.motivo}</p>
                {c.nota ? (
                  <p className="mt-2 border-l-2 border-lab-linha pl-3 leading-6 text-lab-tinta-2">
                    Decisão{c.decididoPor ? ` de ${c.decididoPor}` : ""}: {c.nota}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Cartao>
      ) : null}
    </div>
  );
}

const NIVEIS = [1, 2, 3, 4, 5] as const;

/**
 * Onde o curador valida. O nível de cada skill nasce igual ao calculado; mudar qualquer um é um
 * ajuste e exige justificativa. Validar é definitivo, por isso passa por uma confirmação.
 */
function ValidacaoDoResultado({ ficha }: { ficha: LabFichaDeRevisao }) {
  const validar = useValidar(ficha.resultadoId);
  const notificar = useNotificar();
  const editavel = ficha.statusValidacao === "aguardando_validacao";
  const [niveis, setNiveis] = useState<Record<string, number>>(() =>
    Object.fromEntries(ficha.skills.map((s) => [s.skillId, s.nivelCalculado]))
  );
  const [justificativa, setJustificativa] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const ajustes = ficha.skills.filter((s) => niveis[s.skillId] !== s.nivelCalculado);

  const pedirConfirmacao = () => {
    if (ajustes.length > 0 && justificativa.trim() === "") {
      setAviso("Explique o ajuste: sem justificativa o resultado não pode ser ajustado.");
      return;
    }
    setAviso(null);
    setConfirmando(true);
  };

  const confirmar = () =>
    validar.mutate(
      {
        ajustes: ajustes.map((s) => ({ skillId: s.skillId, nivel: niveis[s.skillId] as number })),
        ...(justificativa.trim() === "" ? {} : { justificativa: justificativa.trim() })
      },
      {
        onSuccess: () => {
          setConfirmando(false);
          notificar({ tom: "sucesso", titulo: "Resultado validado" });
        }
      }
    );

  return (
    <Cartao
      titulo="Nível por skill e validação"
      {...(editavel
        ? {
            descricao:
              "O nível calculado vem das escolhas. Confirme-o ou ajuste o que a conversa com o participante mostrar."
          }
        : {})}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-lab-linha text-lab-pequeno">
          <thead className="text-left text-lab-legenda text-lab-tinta-2">
            <tr>
              <th className="py-2 pr-4 font-semibold">Skill</th>
              <th className="px-4 py-2 font-semibold">Escolhas</th>
              <th className="px-4 py-2 font-semibold">Média</th>
              <th className="px-4 py-2 font-semibold">Calculado</th>
              <th className="py-2 pl-4 font-semibold">{editavel ? "Validar como" : "Validado"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-lab-linha">
            {ficha.skills.map((s) => {
              const mudou = niveis[s.skillId] !== s.nivelCalculado;
              return (
                <tr key={s.skillId}>
                  <td className="py-2.5 pr-4">
                    <span className="block font-medium text-lab-tinta">{s.nome}</span>
                    <span className="block text-lab-legenda text-lab-tinta-2">
                      {s.tipo ? nomeDoTipoDeSkill[s.tipo] : ""}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{s.nEvidencias}</td>
                  <td className="px-4 py-2.5">{formatarNumero(s.media)}</td>
                  <td className="px-4 py-2.5 font-semibold">{s.nivelCalculado}/5</td>
                  <td className="py-2.5 pl-4">
                    {editavel ? (
                      <span className="inline-flex items-center gap-2">
                        <select
                          aria-label={`Nível validado de ${s.nome}`}
                          className="h-10 cursor-pointer rounded-lab-md border border-lab-linha-forte bg-lab-superficie px-2.5 text-lab-pequeno text-lab-tinta outline-none transition focus:border-lab-destaque focus:ring-4 focus:ring-lab-destaque/15"
                          value={niveis[s.skillId]}
                          onChange={(e) =>
                            setNiveis((atual) => ({
                              ...atual,
                              [s.skillId]: Number(e.target.value)
                            }))
                          }
                        >
                          {NIVEIS.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        {mudou ? <Badge tone="warning">Ajuste</Badge> : null}
                      </span>
                    ) : (
                      <span className="font-semibold">
                        {s.nivelValidado ?? s.nivelCalculado}/5
                        {s.nivelValidado !== null && s.nivelValidado !== s.nivelCalculado ? (
                          <Badge tone="warning" className="ml-2">
                            Ajustado
                          </Badge>
                        ) : null}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editavel ? (
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            pedirConfirmacao();
          }}
        >
          <div className="grid gap-2 text-lab-pequeno font-medium text-lab-tinta-2">
            <label htmlFor="justificativa-da-validacao">
              Justificativa{" "}
              <span className="font-normal text-lab-tinta-2">
                {ajustes.length > 0 ? "(obrigatória: você mudou algum nível)" : "(opcional)"}
              </span>
            </label>
            <Textarea
              id="justificativa-da-validacao"
              rows={3}
              maxLength={labLimitesDeTexto.nota}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
            />
            <span className="text-lab-legenda font-normal text-lab-tinta-2">
              {justificativa.length}/{labLimitesDeTexto.nota}. Fica guardada com a validação; o
              participante não a recebe.
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
          <Button type="submit" disabled={validar.isPending}>
            {ajustes.length > 0
              ? `Validar com ${ajustes.length === 1 ? "1 ajuste" : `${ajustes.length} ajustes`}`
              : "Validar resultado"}
          </Button>
        </form>
      ) : (
        <div className="mt-5 space-y-1 rounded-lab-md bg-lab-superficie-2 p-4 text-lab-pequeno text-lab-tinta-2">
          <p>
            <span className="font-medium">Validado</span>
            {ficha.validacao.validadoPor ? ` por ${ficha.validacao.validadoPor}` : ""}
            {ficha.validacao.validadoEm
              ? ` em ${formatarDataEHora(ficha.validacao.validadoEm)}`
              : ""}
            . Uma validação não se refaz.
          </p>
          {ficha.validacao.justificativa ? (
            <p>
              <span className="font-medium">Justificativa:</span> {ficha.validacao.justificativa}
            </p>
          ) : null}
        </div>
      )}

      <Confirmacao
        aberta={confirmando}
        titulo={ajustes.length > 0 ? "Validar com ajuste?" : "Validar este resultado?"}
        descricao={
          ajustes.length > 0
            ? `Você trocou o nível de ${ajustes.length === 1 ? "1 skill" : `${ajustes.length} skills`}. O resultado passa a fazer parte do histórico oficial do participante, e uma validação não se refaz.`
            : "O resultado passa a fazer parte do histórico oficial do participante, com os níveis calculados. Uma validação não se refaz."
        }
        confirmar={ajustes.length > 0 ? "Validar com ajuste" : "Validar resultado"}
        pendente={validar.isPending}
        erro={
          validar.isError
            ? descreverErroDoCadastro(validar.error, "acompanhamento").descricao
            : null
        }
        aoCancelar={() => {
          setConfirmando(false);
          validar.reset();
        }}
        aoConfirmar={confirmar}
      />
    </Cartao>
  );
}

function tomDaAderencia(aderencia: number): "success" | "info" | "warning" | "danger" | "neutral" {
  if (aderencia >= 100) return "success";
  if (aderencia >= 70) return "info";
  if (aderencia >= 40) return "warning";
  if (aderencia > 0) return "danger";
  return "neutral";
}

function SituacaoDaFichaItem({ situacao }: { situacao: LabSituacaoDaFicha }) {
  const escolhida = situacao.opcoes.find((o) => o.id === situacao.escolha);
  return (
    <li className="rounded-lab-lg border border-lab-linha">
      <details>
        <summary className="flex cursor-pointer flex-wrap items-center gap-2 p-3 text-lab-pequeno">
          <span className="font-semibold text-lab-tinta">Situação {situacao.numero}</span>
          {situacao.marco ? <Badge tone="warning">Marco</Badge> : null}
          <Badge tone={tomDaAderencia(situacao.aderencia)}>
            Aderência {formatarNumero(situacao.aderencia)}%
          </Badge>
          {situacao.alertaVermelho ? <Badge tone="danger">Alerta vermelho</Badge> : null}
          <span className="text-lab-tinta-2">
            {situacao.tempoEsgotado || !escolhida ? "Sem resposta" : `Escolheu ${escolhida.id}`}
          </span>
        </summary>
        <div className="space-y-2 border-t border-lab-linha p-3 text-lab-pequeno leading-6">
          <p className="text-lab-tinta">{situacao.texto}</p>
          <ul className="space-y-1 text-lab-tinta-2">
            {situacao.opcoes.map((o) => (
              <li
                key={o.id}
                className={o.id === situacao.escolha ? "font-semibold text-lab-tinta" : ""}
              >
                {o.id}. {o.texto}
                {o.id === situacao.escolha ? " (escolhida)" : ""}
              </li>
            ))}
          </ul>
          {situacao.tempoEsgotado ? (
            <p className="font-medium text-lab-tinta">O tempo acabou sem resposta.</p>
          ) : situacao.tempoRespostaMs !== null ? (
            <p className="text-lab-tinta-2">
              Respondeu em {formatarNumero(situacao.tempoRespostaMs / 1000)} s
              {situacao.estilo ? ` · estilo ${nomeDoEstilo[situacao.estilo]}` : ""}
            </p>
          ) : null}
          {situacao.justificativa ? (
            <p className="text-lab-tinta-2">
              <span className="font-medium text-lab-tinta">Avaliação:</span>{" "}
              {situacao.justificativa}
            </p>
          ) : null}
          {situacao.consequencia ? (
            <p className="border-l-2 border-lab-linha pl-3 italic text-lab-tinta-2">
              {situacao.consequencia}
            </p>
          ) : null}
        </div>
      </details>
    </li>
  );
}
