// Avatar com iniciais e anel colorido pela situação (esmeralda: ativo; âmbar: afastado; vermelho:
// desligado; cinza: demais). Escrito do zero. Por quê: dá rosto à lista e deixa a situação visível
// de relance sem depender só de cor (o rótulo da situação continua ao lado). Sem efeito decorativo
// em vermelho ou âmbar: o anel é estático.
import { cn } from "../../lib/cn";

export type TomDoAvatar = "ativo" | "atencao" | "perigo" | "neutro";

const aneis: Record<TomDoAvatar, string> = {
  ativo: "ring-mf-brilho/60 bg-mf-realce-suave text-mf-primaria",
  atencao: "ring-mf-alerta/50 bg-mf-alerta-suave text-mf-alerta",
  perigo: "ring-mf-perigo/50 bg-mf-perigo-suave text-mf-perigo",
  neutro: "ring-mf-texto-3/30 bg-slate-100 text-mf-texto-2"
};

export function Avatar({
  nome,
  tom = "neutro",
  compacto = false,
  className
}: {
  nome: string;
  tom?: TomDoAvatar;
  /** 36 px em vez de 40 (linhas de tabela). */
  compacto?: boolean;
  className?: string;
}) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const iniciais = `${partes[0]?.[0] ?? ""}${partes.length > 1 ? (partes.at(-1)?.[0] ?? "") : ""}`;
  return (
    <span
      aria-hidden="true"
      className={cn(
        compacto ? "h-9 w-9 text-xs" : "h-10 w-10 text-sm",
        "grid shrink-0 place-items-center rounded-full font-display font-bold ring-2 ring-offset-2 ring-offset-white",
        aneis[tom],
        className
      )}
    >
      {iniciais.toLocaleUpperCase("pt-BR")}
    </span>
  );
}
