import { Component, lazy, type ReactNode, Suspense } from "react";
import { useAnimacaoReduzida } from "../ui/movimento";
import { descricaoDoEstado } from "../rotulos";
import { AvatarFacilitador, type EstadoDoAvatar } from "./avatar-facilitador";
import { suportaWebGL } from "./avatar-suporte";

// O three.js só carrega quando um facilitador 3D é mostrado.
const Avatar3DCena = lazy(() => import("./avatar-3d-cena"));

type AvatarFacilitador3DProps = { estado: EstadoDoAvatar; tamanho?: number };

/** Se o WebGL falhar na hora de desenhar (contexto perdido, por exemplo), cai para o avatar 2D. */
class FallbackSeFalhar extends Component<
  { fallback: ReactNode; children: ReactNode },
  { falhou: boolean }
> {
  state = { falhou: false };
  static getDerivedStateFromError() {
    return { falhou: true };
  }
  render() {
    return this.state.falhou ? this.props.fallback : this.props.children;
  }
}

/**
 * O facilitador em 3D, com o mesmo contrato do `AvatarFacilitador` (estado e tamanho). Sem WebGL
 * ou se o 3D falhar, mostra o avatar 2D. Com "reduzir movimento", a pose é estática. O estado
 * também é dito em texto (`role="img"` com o rótulo), como no 2D.
 */
export function AvatarFacilitador3D({ estado, tamanho = 96 }: AvatarFacilitador3DProps) {
  const parado = useAnimacaoReduzida();
  const doisD = <AvatarFacilitador estado={estado} tamanho={tamanho} />;
  if (!suportaWebGL()) return doisD;
  return (
    <div
      role="img"
      aria-label={`Facilitador, ${descricaoDoEstado[estado]}`}
      data-estado={estado}
      data-modo="3d"
      className="shrink-0"
      style={{ width: tamanho, height: tamanho * 1.3 }}
    >
      <FallbackSeFalhar fallback={<div aria-hidden="true">{doisD}</div>}>
        <Suspense fallback={<div aria-hidden="true">{doisD}</div>}>
          <Avatar3DCena estado={estado} tamanho={tamanho} parado={parado} />
        </Suspense>
      </FallbackSeFalhar>
    </div>
  );
}
