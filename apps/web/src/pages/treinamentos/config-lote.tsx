/* eslint-disable react-refresh/only-export-components */
// Treinamentos — configuração: importar vários cenários de uma vez (um ou mais arquivos .json, cada um
// com um cenário ou uma lista), exportar os selecionados e aprovar em lote. Tudo entra como RASCUNHO:
// a importação nunca aprova nada. O relatório diz, arquivo por arquivo e cenário por cenário, o que
// entrou, o que já existia e o que tem problema (com o caminho exato).
import { CheckCircle2, Download, FileUp, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui";
import {
  apiDosTreinamentos,
  type CenarioDaLista,
  type RelatorioDaImportacao
} from "../../features/treinamentos/api";
import { nomeDoPublico } from "./config-regras";

type ItemDoRelatorio = RelatorioDaImportacao["itens"][number] & { arquivo: string };
type Relatorio = {
  criados: number;
  jaExistem: number;
  invalidos: number;
  itens: ItemDoRelatorio[];
  /** Arquivos que nem JSON eram. */
  ilegiveis: { arquivo: string; erro: string }[];
};

const rotuloDoEstado = {
  criado: "Importado",
  ja_existe: "Já existe",
  invalido: "Com problema"
} as const;

/** Salva um texto como arquivo (o navegador baixa). */
export function baixar(nome: string, conteudo: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(conteudo, null, 2)], { type: "application/json" })
  );
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  ancora.click();
  URL.revokeObjectURL(url);
}

export function PainelDeLote({
  cenarios,
  aoMudar
}: {
  cenarios: CenarioDaLista[];
  aoMudar: (mensagem: string) => void;
}) {
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  const alternar = (id: string) =>
    setMarcados((atuais) => {
      const novos = new Set(atuais);
      if (novos.has(id)) novos.delete(id);
      else novos.add(id);
      return novos;
    });
  const selecionados = cenarios.filter((c) => marcados.has(c.id));
  // Aprovar em lote: a versão mais nova de cada selecionado que ainda não foi aprovada.
  const aprovaveis = selecionados.flatMap((c) => {
    const v = c.versoes[0];
    return v && !v.aprovadoEm ? [{ cenarioId: c.id, versaoId: v.id }] : [];
  });

  async function importar(arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return;
    setErro("");
    setRelatorio(null);
    setOcupado(true);
    try {
      const itens: ItemDoRelatorio[] = [];
      const ilegiveis: Relatorio["ilegiveis"] = [];
      let criados = 0;
      let jaExistem = 0;
      let invalidos = 0;
      for (const arquivo of Array.from(arquivos)) {
        let lido: unknown;
        try {
          lido = JSON.parse(await arquivo.text());
        } catch (e) {
          ilegiveis.push({
            arquivo: arquivo.name,
            erro: e instanceof Error ? e.message : "JSON inválido"
          });
          continue;
        }
        const lista = Array.isArray(lido) ? lido : [lido];
        if (lista.length === 0) continue;
        const r = await apiDosTreinamentos.importar(lista);
        criados += r.criados;
        jaExistem += r.jaExistem;
        invalidos += r.invalidos;
        itens.push(...r.itens.map((i) => ({ ...i, arquivo: arquivo.name })));
      }
      setRelatorio({ criados, jaExistem, invalidos, itens, ilegiveis });
      if (criados > 0) aoMudar(`${criados} cenário(s) importado(s) como rascunho.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível importar.");
    } finally {
      setOcupado(false);
    }
  }

  async function exportar() {
    setErro("");
    setOcupado(true);
    try {
      const conteudos = [];
      for (const c of selecionados) {
        const v = c.versoes[0];
        if (v) conteudos.push((await apiDosTreinamentos.lerVersao(c.id, v.id)).conteudo);
      }
      baixar(
        selecionados.length === 1 ? `${selecionados[0]!.slug}.json` : "cenarios.json",
        selecionados.length === 1 ? conteudos[0] : conteudos
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível exportar.");
    } finally {
      setOcupado(false);
    }
  }

  async function aprovarEmLote() {
    if (
      !window.confirm(
        `Aprovar ${aprovaveis.length} ${aprovaveis.length === 1 ? "versão" : "versões"}?\n\nCada versão aprovada fica congelada e passa a poder ser sorteada nos testes. Confirme que o conteúdo foi revisado pela área responsável.`
      )
    )
      return;
    setErro("");
    setOcupado(true);
    try {
      const r = await apiDosTreinamentos.aprovarEmLote(aprovaveis);
      setMarcados(new Set());
      aoMudar(
        r.recusadas === 0
          ? `${r.aprovadas} versão(ões) aprovada(s).`
          : `${r.aprovadas} aprovada(s); ${r.recusadas} recusada(s) (já aprovadas ou com problema).`
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível aprovar em lote.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section
      aria-labelledby="lote-titulo"
      className="rounded-mf-cartao border border-mf-linha bg-mf-cartao p-5 shadow-mf-1"
    >
      <h2
        id="lote-titulo"
        className="flex items-center gap-2 font-display text-lg font-bold text-mf-tinta"
      >
        <FileUp size={18} aria-hidden="true" className="text-mf-primaria" />
        Importar, exportar e aprovar em lote
      </h2>
      <p className="mt-1 text-sm text-mf-texto-2">
        Importe um ou vários arquivos .json (cada um com um cenário ou uma lista deles, no formato
        do sistema ou no do pacote do Leadership Lab). Tudo entra como rascunho; a aprovação é
        sempre um passo seguinte, depois da revisão de conteúdo.
      </p>
      <label className="mt-3 block text-sm font-medium text-mf-texto">
        Arquivos .json
        <input
          type="file"
          multiple
          accept=".json,application/json"
          disabled={ocupado}
          onChange={(e) => {
            void importar(e.target.files);
            e.target.value = "";
          }}
          className="mt-1 block min-h-11 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-mf-realce-suave file:px-3 file:py-1.5 file:text-mf-primaria"
        />
      </label>

      {relatorio ? (
        <div
          className="mt-3 rounded-mf-controle border border-mf-linha p-3 text-sm"
          aria-label="Relatório da importação"
        >
          <p className="font-semibold text-mf-tinta">
            {relatorio.criados} importado(s), {relatorio.jaExistem} já existia(m),{" "}
            {relatorio.invalidos} com problema
            {relatorio.ilegiveis.length
              ? `, ${relatorio.ilegiveis.length} arquivo(s) ilegível(is)`
              : ""}
            .
          </p>
          <ul className="mt-2 space-y-1">
            {relatorio.ilegiveis.map((a) => (
              <li key={a.arquivo} className="text-mf-perigo">
                <TriangleAlert size={14} aria-hidden="true" className="mr-1 inline" />
                {a.arquivo}: {a.erro}
              </li>
            ))}
            {relatorio.itens
              .filter((i) => i.estado !== "criado")
              .map((i, k) => (
                <li
                  key={k}
                  className={i.estado === "invalido" ? "text-mf-perigo" : "text-mf-texto-2"}
                >
                  <span className="font-mono text-xs">{i.arquivo}</span> ·{" "}
                  <span className="font-mono text-xs">{i.slug ?? "(sem id)"}</span>:{" "}
                  {rotuloDoEstado[i.estado]}
                  {i.problemas?.length ? (
                    <ul className="ml-4 list-disc">
                      {i.problemas.map((p, n) => (
                        <li key={n}>
                          <code className="rounded bg-white px-1 font-mono text-xs">
                            {p.caminho}
                          </code>{" "}
                          {p.mensagem}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {cenarios.length > 0 ? (
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-mf-tinta">Selecione cenários</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setMarcados(
                  new Set(cenarios.filter((c) => !c.versoes[0]?.aprovadoEm).map((c) => c.id))
                )
              }
            >
              Marcar os sem aprovação
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMarcados(new Set())}>
              Limpar
            </Button>
          </div>
          <ul className="mt-2 max-h-64 divide-y divide-mf-linha overflow-y-auto rounded-mf-controle border border-mf-linha">
            {cenarios.map((c) => (
              <li key={c.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={marcados.has(c.id)}
                    onChange={() => alternar(c.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {c.titulo}
                    <span className="ml-2 text-xs text-mf-texto-3">
                      {c.publico
                        ? (nomeDoPublico[c.publico as keyof typeof nomeDoPublico] ?? c.publico)
                        : "sem público"}
                    </span>
                  </span>
                  <span className="text-xs text-mf-texto-3">{c.status}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              icon={<Download size={16} />}
              disabled={selecionados.length === 0 || ocupado}
              onClick={() => void exportar()}
            >
              Exportar selecionados ({selecionados.length})
            </Button>
            <Button
              icon={<CheckCircle2 size={16} />}
              disabled={aprovaveis.length === 0 || ocupado}
              onClick={() => void aprovarEmLote()}
            >
              Aprovar em lote ({aprovaveis.length})
            </Button>
          </div>
        </fieldset>
      ) : null}
      {erro ? (
        <p role="alert" className="mt-2 text-sm text-mf-perigo">
          {erro}
        </p>
      ) : null}
    </section>
  );
}
