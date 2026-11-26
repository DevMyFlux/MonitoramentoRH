/* eslint-disable react-hooks/set-state-in-effect, react-refresh/only-export-components */
// Treinamentos — configuração do teste do Lab: a REGRA DE PÚBLICO (nível + área -> público) e a
// QUANTIDADE de cenários de cada público (e de cada turma). ADMIN e DEV editam; o RH só lê. Salvar
// substitui a tabela inteira; a API valida e grava a auditoria. Sem regra que sirva, vale o padrão.
import {
  niveisDeGovernanca,
  rotuloDoNivel,
  treinoPublicos,
  type TreinoPublico
} from "@my-flux/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, ErrorState, Skeleton } from "../../components/ui";
import {
  apiDosTreinamentos,
  type ItemDeQuantidade,
  type RegraDePublicoDaTela
} from "../../features/treinamentos/api";

export const nomeDoPublico: Record<TreinoPublico, string> = {
  "supervisor-manutencao-adm": "Supervisores de manutenção e administrativo",
  "coordenador-administrativo": "Coordenadores administrativos",
  rh: "RH",
  "administrativo-geral": "Administrativo geral"
};

const campo =
  "block h-11 w-full rounded-mf-controle border border-mf-linha bg-white px-2 text-sm font-normal";

const QUALQUER = "";

export function PainelDeRegras({ podeEditar }: { podeEditar: boolean }) {
  const cache = useQueryClient();
  const consulta = useQuery({
    queryKey: ["treinamentos", "regras"],
    queryFn: apiDosTreinamentos.regras,
    retry: false
  });
  const [regras, setRegras] = useState<RegraDePublicoDaTela[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (consulta.data) setRegras(consulta.data.regras);
  }, [consulta.data]);

  const areas = consulta.data?.areas ?? [];
  const mexer = (i: number, parte: Partial<RegraDePublicoDaTela>) =>
    setRegras((atuais) => atuais.map((r, k) => (k === i ? { ...r, ...parte } : r)));
  const mover = (i: number, delta: number) =>
    setRegras((atuais) => {
      const novas = [...atuais];
      const j = i + delta;
      if (j < 0 || j >= novas.length) return atuais;
      [novas[i], novas[j]] = [novas[j]!, novas[i]!];
      return novas;
    });

  async function salvar() {
    setErro("");
    setMensagem("");
    if (regras.some((r) => r.nivelGovernanca === null && r.areaId === null))
      return setErro("Toda regra precisa de um nível, de uma área, ou dos dois.");
    setSalvando(true);
    try {
      await apiDosTreinamentos.salvarRegras(regras);
      setMensagem("Regras salvas. Valem a partir do próximo teste de cada pessoa.");
      void cache.invalidateQueries({ queryKey: ["treinamentos", "regras"] });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar as regras.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section
      aria-labelledby="regras-titulo"
      className="rounded-mf-cartao border border-mf-linha bg-mf-cartao p-5 shadow-mf-1"
    >
      <h2 id="regras-titulo" className="font-display text-lg font-bold text-mf-tinta">
        Regra de público
      </h2>
      <p className="mt-1 text-sm text-mf-texto-2">
        Define qual público de cenários cada conta recebe no teste do Leadership Lab, pelo nível de
        governança e pela área. Vale a regra mais específica (nível e área juntos, depois só a área,
        depois só o nível); em empate, a de cima. Sem regra que sirva, vale o padrão do sistema.
        {podeEditar ? "" : " Só ADMIN e DEV editam."}
      </p>
      {consulta.isPending ? (
        <Skeleton className="mt-3 h-24 rounded-mf-cartao" />
      ) : consulta.isError ? (
        <div className="mt-3">
          <ErrorState
            title="Não foi possível carregar as regras"
            description={consulta.error.message}
            onRetry={() => void consulta.refetch()}
          />
        </div>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-mf-texto-3">
                <tr>
                  <th className="px-2 py-2">Nível</th>
                  <th className="px-2 py-2">Área</th>
                  <th className="px-2 py-2">Público</th>
                  <th className="px-2 py-2">Ativa</th>
                  {podeEditar ? <th className="px-2 py-2 text-right">Ações</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-mf-linha">
                {regras.map((r, i) => (
                  <tr key={i}>
                    <td className="min-w-40 px-2 py-2">
                      {podeEditar ? (
                        <select
                          aria-label={`Nível da regra ${i + 1}`}
                          className={campo}
                          value={r.nivelGovernanca ?? QUALQUER}
                          onChange={(e) =>
                            mexer(i, {
                              nivelGovernanca:
                                e.target.value === QUALQUER
                                  ? null
                                  : (e.target.value as RegraDePublicoDaTela["nivelGovernanca"])
                            })
                          }
                        >
                          <option value={QUALQUER}>Qualquer nível</option>
                          {niveisDeGovernanca.map((n) => (
                            <option key={n} value={n}>
                              {rotuloDoNivel[n]}
                            </option>
                          ))}
                        </select>
                      ) : r.nivelGovernanca ? (
                        rotuloDoNivel[r.nivelGovernanca]
                      ) : (
                        "Qualquer nível"
                      )}
                    </td>
                    <td className="min-w-40 px-2 py-2">
                      {podeEditar ? (
                        <select
                          aria-label={`Área da regra ${i + 1}`}
                          className={campo}
                          value={r.areaId ?? QUALQUER}
                          onChange={(e) =>
                            mexer(i, {
                              areaId: e.target.value === QUALQUER ? null : e.target.value
                            })
                          }
                        >
                          <option value={QUALQUER}>Qualquer área</option>
                          {areas.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.nome}
                            </option>
                          ))}
                        </select>
                      ) : (
                        (areas.find((a) => a.id === r.areaId)?.nome ?? "Qualquer área")
                      )}
                    </td>
                    <td className="min-w-56 px-2 py-2">
                      {podeEditar ? (
                        <select
                          aria-label={`Público da regra ${i + 1}`}
                          className={campo}
                          value={r.publico}
                          onChange={(e) => mexer(i, { publico: e.target.value as TreinoPublico })}
                        >
                          {treinoPublicos.map((p) => (
                            <option key={p} value={p}>
                              {nomeDoPublico[p]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        nomeDoPublico[r.publico]
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Regra ${i + 1} ativa`}
                        checked={r.ativa}
                        disabled={!podeEditar}
                        onChange={(e) => mexer(i, { ativa: e.target.checked })}
                      />
                    </td>
                    {podeEditar ? (
                      <td className="px-2 py-2">
                        <span className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Subir a regra ${i + 1}`}
                            icon={<ArrowUp size={14} />}
                            disabled={i === 0}
                            onClick={() => mover(i, -1)}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Descer a regra ${i + 1}`}
                            icon={<ArrowDown size={14} />}
                            disabled={i === regras.length - 1}
                            onClick={() => mover(i, 1)}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Remover a regra ${i + 1}`}
                            icon={<Trash2 size={14} />}
                            onClick={() => setRegras((atuais) => atuais.filter((_, k) => k !== i))}
                          />
                        </span>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {podeEditar ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                icon={<Plus size={16} />}
                onClick={() =>
                  setRegras((atuais) => [
                    ...atuais,
                    { nivelGovernanca: "supervisor", areaId: null, publico: "rh", ativa: true }
                  ])
                }
              >
                Adicionar regra
              </Button>
              <Button icon={<Save size={16} />} disabled={salvando} onClick={() => void salvar()}>
                {salvando ? "Salvando..." : "Salvar regras"}
              </Button>
            </div>
          ) : null}
          {erro ? (
            <p role="alert" className="mt-2 text-sm text-mf-perigo">
              {erro}
            </p>
          ) : null}
          {mensagem ? (
            <p role="status" className="mt-2 text-sm text-mf-primaria">
              {mensagem}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

export function PainelDeQuantidades({ podeEditar }: { podeEditar: boolean }) {
  const cache = useQueryClient();
  const consulta = useQuery({
    queryKey: ["treinamentos", "quantidades"],
    queryFn: apiDosTreinamentos.quantidades,
    retry: false
  });
  const turmas = useQuery({
    queryKey: ["treinamentos", "turmas"],
    queryFn: apiDosTreinamentos.turmas,
    retry: false,
    enabled: podeEditar
  });
  const [itens, setItens] = useState<ItemDeQuantidade[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (consulta.data)
      setItens(
        consulta.data.itens.map(({ publico, turmaId, quantidade }) => ({
          publico,
          turmaId,
          quantidade
        }))
      );
  }, [consulta.data]);

  const mexer = (i: number, parte: Partial<ItemDeQuantidade>) =>
    setItens((atuais) => atuais.map((r, k) => (k === i ? { ...r, ...parte } : r)));
  const nomeDaTurma = (id: string | null) =>
    id === null
      ? "Todas as turmas"
      : (consulta.data?.itens.find((i) => i.turmaId === id)?.turma ??
        turmas.data?.find((t) => t.id === id)?.nome ??
        "Turma");

  async function salvar() {
    setErro("");
    setMensagem("");
    setSalvando(true);
    try {
      await apiDosTreinamentos.salvarQuantidades(itens);
      setMensagem("Quantidades salvas. Valem a partir do próximo teste de cada pessoa.");
      void cache.invalidateQueries({ queryKey: ["treinamentos", "quantidades"] });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar as quantidades.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section
      aria-labelledby="quantidades-titulo"
      className="rounded-mf-cartao border border-mf-linha bg-mf-cartao p-5 shadow-mf-1"
    >
      <h2 id="quantidades-titulo" className="font-display text-lg font-bold text-mf-tinta">
        Quantos cenários compõem o teste
      </h2>
      <p className="mt-1 text-sm text-mf-texto-2">
        O padrão é {consulta.data?.padrao ?? 3} cenários por teste. Aqui você muda a quantidade de
        um público ou de uma turma do Lab (a da turma vale no lugar da do público). Os cenários são
        sorteados entre os aprovados do público, sem repetir os já feitos.
        {podeEditar ? "" : " Só ADMIN e DEV editam."}
      </p>
      {consulta.isPending ? (
        <Skeleton className="mt-3 h-16 rounded-mf-cartao" />
      ) : consulta.isError ? (
        <div className="mt-3">
          <ErrorState
            title="Não foi possível carregar as quantidades"
            description={consulta.error.message}
            onRetry={() => void consulta.refetch()}
          />
        </div>
      ) : (
        <>
          {itens.length === 0 ? (
            <p className="mt-3 text-sm text-mf-texto-3">
              Nenhuma quantidade configurada: vale o padrão para todos.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-mf-linha rounded-mf-controle border border-mf-linha">
              {itens.map((item, i) => (
                <li key={i} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                  {podeEditar ? (
                    <>
                      <select
                        aria-label={`Público da quantidade ${i + 1}`}
                        className={`${campo} max-w-64`}
                        value={item.publico}
                        onChange={(e) => mexer(i, { publico: e.target.value as TreinoPublico })}
                      >
                        {treinoPublicos.map((p) => (
                          <option key={p} value={p}>
                            {nomeDoPublico[p]}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label={`Turma da quantidade ${i + 1}`}
                        className={`${campo} max-w-56`}
                        value={item.turmaId ?? QUALQUER}
                        onChange={(e) =>
                          mexer(i, { turmaId: e.target.value === QUALQUER ? null : e.target.value })
                        }
                      >
                        <option value={QUALQUER}>Todas as turmas</option>
                        {(turmas.data ?? []).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nome}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        aria-label={`Quantidade ${i + 1}`}
                        className={`${campo} max-w-24`}
                        value={item.quantidade}
                        onChange={(e) => mexer(i, { quantidade: Number(e.target.value) })}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Remover a quantidade ${i + 1}`}
                        icon={<Trash2 size={14} />}
                        onClick={() => setItens((atuais) => atuais.filter((_, k) => k !== i))}
                      />
                    </>
                  ) : (
                    <span>
                      {nomeDoPublico[item.publico]} · {nomeDaTurma(item.turmaId)}:{" "}
                      <strong>{item.quantidade}</strong>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {podeEditar ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                icon={<Plus size={16} />}
                onClick={() =>
                  setItens((atuais) => [...atuais, { publico: "rh", turmaId: null, quantidade: 3 }])
                }
              >
                Adicionar quantidade
              </Button>
              <Button icon={<Save size={16} />} disabled={salvando} onClick={() => void salvar()}>
                {salvando ? "Salvando..." : "Salvar quantidades"}
              </Button>
            </div>
          ) : null}
          {erro ? (
            <p role="alert" className="mt-2 text-sm text-mf-perigo">
              {erro}
            </p>
          ) : null}
          {mensagem ? (
            <p role="status" className="mt-2 text-sm text-mf-primaria">
              {mensagem}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
