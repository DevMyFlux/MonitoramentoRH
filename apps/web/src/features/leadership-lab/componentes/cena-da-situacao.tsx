import type { LabCena } from "@my-flux/shared";
import { FlaskConical } from "lucide-react";
import { Badge } from "../ui";
import { descricaoDoEstado, nomeDoPersonagem } from "../rotulos";
import type { EstadoDoAvatar } from "./avatar-facilitador";
import { AvatarFacilitador3D } from "./avatar-facilitador-3d";
import { Personagem } from "./personagens";

type CenaDaSituacaoProps = { cena: LabCena | null; estado: EstadoDoAvatar };

/**
 * A cena: o facilitador de um lado e, quando a situação é da simulação local, quem está em cena do
 * outro, com o tema. Tudo ilustração vetorial e texto: nenhuma avaliação passa por aqui.
 */
export function CenaDaSituacao({ cena, estado }: CenaDaSituacaoProps) {
  return (
    <div className="rounded-lab-xl border border-lab-linha bg-gradient-to-br from-lab-destaque-suave/80 via-lab-superficie to-lab-info-suave/60 p-5">
      {cena ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone="info" className="gap-1">
            <FlaskConical size={12} aria-hidden="true" /> Simulação local · {cena.temaNome}
          </Badge>
          <span className="text-lab-legenda text-lab-tinta-2">{cena.titulo}</span>
        </div>
      ) : null}
      <div className="flex items-end justify-between gap-4">
        <figure className="flex w-32 flex-col items-center gap-1 text-center">
          <AvatarFacilitador3D estado={estado} tamanho={104} />
          <figcaption className="text-lab-legenda font-medium text-lab-tinta">
            Facilitador
          </figcaption>
        </figure>
        <p
          aria-live="polite"
          className="hidden min-w-0 flex-1 text-center text-lab-legenda italic text-lab-tinta-2 sm:block"
        >
          O facilitador está {descricaoDoEstado[estado]}.
        </p>
        {cena ? (
          <figure className="flex w-28 flex-col items-center gap-1 text-center">
            <Personagem personagem={cena.personagem} tamanho={88} />
            <figcaption className="text-lab-legenda font-medium text-lab-tinta">
              {nomeDoPersonagem[cena.personagem]}
            </figcaption>
          </figure>
        ) : null}
      </div>
    </div>
  );
}
