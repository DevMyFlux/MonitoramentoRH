import type { LabCena } from "@my-flux/shared";
import { FlaskConical } from "lucide-react";
import { Badge } from "../../../components/ui";
import { descricaoDoEstado, nomeDoPersonagem } from "../rotulos";
import { AvatarFacilitador, type EstadoDoAvatar } from "./avatar-facilitador";
import { Personagem } from "./personagens";

type CenaDaSituacaoProps = { cena: LabCena | null; estado: EstadoDoAvatar };

/**
 * A cena: o facilitador de um lado e, quando a situação é da simulação local, quem está em cena do
 * outro, com o tema. Tudo ilustração vetorial e texto: nenhuma avaliação passa por aqui.
 */
export function CenaDaSituacao({ cena, estado }: CenaDaSituacaoProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-4">
      {cena ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone="info" className="gap-1">
            <FlaskConical size={12} aria-hidden="true" /> Simulação local · {cena.temaNome}
          </Badge>
          <span className="text-xs text-slate-500">{cena.titulo}</span>
        </div>
      ) : null}
      <div className="flex items-end justify-between gap-4">
        <figure className="flex w-28 flex-col items-center gap-1 text-center">
          <AvatarFacilitador estado={estado} tamanho={88} />
          <figcaption className="text-xs font-medium text-slate-700">Facilitador</figcaption>
        </figure>
        <p
          aria-live="polite"
          className="hidden min-w-0 flex-1 text-center text-xs italic text-slate-500 sm:block"
        >
          O facilitador está {descricaoDoEstado[estado]}.
        </p>
        {cena ? (
          <figure className="flex w-28 flex-col items-center gap-1 text-center">
            <Personagem personagem={cena.personagem} tamanho={88} />
            <figcaption className="text-xs font-medium text-slate-700">
              {nomeDoPersonagem[cena.personagem]}
            </figcaption>
          </figure>
        ) : null}
      </div>
    </div>
  );
}
