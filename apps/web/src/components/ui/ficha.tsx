// Peças da ficha do colaborador: cartão de perfil, linha do tempo de afastamentos e pasta de
// documentos. Escritas do zero; inspiradas nas ideias de "Profile Card", "Folder" (React Bits,
// reactbits.dev) e de linhas do tempo da 21st.dev, mas sem copiar código. A linha do tempo é
// vertical (e não orbital): numa gaveta estreita, no celular, o orbital não cabe nem se lê.
// Por quê de cada uma: o cartão mostra quem é a pessoa sem rolar; a linha do tempo mostra o que
// já passou, o que está em curso e o que vem; a pasta resume a situação dos documentos.
import { CalendarClock, FileCheck2, FileWarning, FolderOpen, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Avatar, type TomDoAvatar } from "./avatar";
import { Button } from "./button";

// ---- Cartão de perfil ----------------------------------------------------------------------------

export function CartaoDePerfil({
  nome,
  matricula,
  funcao,
  tom,
  situacao,
  etiquetas
}: {
  nome: string;
  matricula: string;
  funcao: string;
  tom: TomDoAvatar;
  situacao: ReactNode;
  etiquetas?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start gap-3.5 rounded-2xl border border-mf-linha bg-gradient-to-br from-mf-realce-suave to-white p-4">
      <Avatar nome={nome || "?"} tom={tom} className="h-14 w-14 text-base" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg font-bold leading-tight text-mf-tinta">
          {nome || "Sem nome"}
        </p>
        <p className="mt-0.5 text-sm text-mf-texto-2">
          <span className="font-mono text-[13px]">{matricula || "—"}</span>
          {funcao ? ` · ${funcao}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">{situacao}</div>
        {etiquetas ? <div className="mt-2 flex flex-wrap gap-2">{etiquetas}</div> : null}
      </div>
    </div>
  );
}

// ---- Linha do tempo de afastamentos ----------------------------------------------------------------

export type MomentoDaLinha = {
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  /** "em-curso", "programado" ou "encerrado": quando a pessoa está no intervalo, antes ou depois. */
  fase: "em-curso" | "programado" | "encerrado";
  duracaoEmDias: number;
};

const fases: Record<MomentoDaLinha["fase"], { rotulo: string; no: string; selo: string }> = {
  "em-curso": {
    rotulo: "Em curso",
    no: "bg-mf-alerta ring-mf-alerta-suave",
    selo: "bg-mf-alerta-suave text-mf-alerta"
  },
  programado: {
    rotulo: "Programado",
    no: "bg-mf-azul ring-mf-azul-suave",
    selo: "bg-mf-azul-suave text-mf-azul"
  },
  encerrado: {
    rotulo: "Encerrado",
    no: "bg-mf-texto-3 ring-slate-100",
    selo: "bg-slate-100 text-mf-texto-2"
  }
};

export function LinhaDoTempo({
  momentos,
  aoRemover
}: {
  momentos: MomentoDaLinha[];
  aoRemover: (id: string) => void;
}) {
  if (momentos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-mf-linha p-6 text-center">
        <CalendarClock size={22} className="mx-auto text-mf-texto-3" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium text-mf-texto">Nenhum afastamento registrado</p>
        <p className="mt-0.5 text-xs text-mf-texto-3">
          Férias, licenças e atestados aparecem aqui.
        </p>
      </div>
    );
  }
  return (
    <ol className="relative space-y-4 pl-6 before:absolute before:bottom-2 before:left-[0.6875rem] before:top-2 before:w-px before:bg-mf-linha">
      {momentos.map((m) => (
        <li key={m.id} className="relative">
          <span
            aria-hidden="true"
            className={cn(
              "absolute -left-6 top-3 h-3.5 w-3.5 rounded-full ring-4",
              fases[m.fase].no
            )}
          />
          <div className="flex items-start justify-between gap-2 rounded-xl border border-mf-linha bg-white p-3">
            <div className="min-w-0">
              <p className="font-medium text-mf-tinta">{m.titulo}</p>
              <p className="mt-0.5 text-xs text-mf-texto-2">
                {m.inicio} – {m.fim} · {m.duracaoEmDias} {m.duracaoEmDias === 1 ? "dia" : "dias"}
              </p>
              <span
                className={cn(
                  "mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  fases[m.fase].selo
                )}
              >
                {fases[m.fase].rotulo}
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 size={14} />}
              onClick={() => aoRemover(m.id)}
              aria-label={`Remover afastamento: ${m.titulo}`}
              className="min-h-11 min-w-11"
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

// ---- Pasta de documentos -----------------------------------------------------------------------------

export type SituacaoDoDocumento = "vencido" | "vence-logo" | "em-dia" | "sem-validade";

export type DocumentoDaPasta = {
  id: string;
  nome: string;
  codigo: string;
  validade: string | null;
  situacao: SituacaoDoDocumento;
  /** ASO ou NR vencidos: pedem a borda de urgência, porque deixam a pessoa fora da escala. */
  critico: boolean;
  detalhe: string;
};

const situacoes: Record<SituacaoDoDocumento, { rotulo: string; selo: string }> = {
  vencido: { rotulo: "Vencido", selo: "bg-mf-perigo-suave text-mf-perigo" },
  "vence-logo": { rotulo: "Vence em breve", selo: "bg-mf-alerta-suave text-mf-alerta" },
  "em-dia": { rotulo: "Em dia", selo: "bg-mf-realce-suave text-mf-primaria" },
  "sem-validade": { rotulo: "Sem validade", selo: "bg-slate-100 text-mf-texto-2" }
};

export function PastaDeDocumentos({ documentos }: { documentos: DocumentoDaPasta[] }) {
  const vencidos = documentos.filter((d) => d.situacao === "vencido").length;
  const emBreve = documentos.filter((d) => d.situacao === "vence-logo").length;
  return (
    <div>
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-mf-linha bg-mf-realce-suave/50 p-3.5">
        <span aria-hidden="true" className="relative grid h-12 w-14 shrink-0 place-items-end">
          <span className="absolute left-0 top-0 h-3 w-7 rounded-t-lg bg-mf-primaria/80" />
          <span className="absolute inset-x-0 bottom-0 top-2 rounded-lg rounded-tl-none bg-mf-primaria" />
          <span className="absolute inset-x-1.5 bottom-1.5 top-4 rounded bg-white/90" />
          <FolderOpen size={16} className="relative mb-2 mr-1 text-mf-primaria" />
        </span>
        <div className="text-sm">
          <p className="font-semibold text-mf-tinta">
            {documentos.length} {documentos.length === 1 ? "documento" : "documentos"} na pasta
          </p>
          <p className="text-xs text-mf-texto-2">
            {vencidos > 0
              ? `${vencidos} vencido${vencidos > 1 ? "s" : ""}`
              : emBreve > 0
                ? `${emBreve} vence${emBreve > 1 ? "m" : ""} em breve`
                : "Tudo em dia"}
          </p>
        </div>
      </div>

      {documentos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-mf-linha p-6 text-center">
          <p className="text-sm font-medium text-mf-texto">A pasta está vazia</p>
          <p className="mt-0.5 text-xs text-mf-texto-3">
            Os documentos (ASO, NRs, certificados) são registrados em Documentos.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {documentos.map((d) => {
            const Icone = d.situacao === "vencido" ? FileWarning : FileCheck2;
            return (
              <li
                key={d.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border bg-white p-3",
                  d.situacao === "vencido" ? "border-mf-perigo/60" : "border-mf-linha",
                  d.critico && d.situacao === "vencido" && "borda-eletrica"
                )}
              >
                <Icone
                  size={18}
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 shrink-0",
                    d.situacao === "vencido" ? "text-mf-perigo" : "text-mf-primaria"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-mf-tinta">{d.nome}</p>
                  <p className="mt-0.5 text-xs text-mf-texto-2">
                    <span className="font-mono">{d.codigo}</span> · {d.detalhe}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    situacoes[d.situacao].selo
                  )}
                >
                  {situacoes[d.situacao].rotulo}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
