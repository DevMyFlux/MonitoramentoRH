// Leadership Lab — o facilitador em 3D (three.js via @react-three/fiber). O personagem é o mascote
// oficial (`facilitador.webp`, recorte com transparência) num plano em perspectiva: gira para
// acompanhar o ponteiro e se move conforme o estado (poses em `avatar-poses.ts`), sobre uma sombra
// suave. Carregado sob demanda por `avatar-facilitador-3d.tsx`.
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { EstadoDoAvatar } from "./avatar-facilitador";
import { amortecer, PROPORCAO_DO_FACILITADOR, type Pose, poses } from "./avatar-poses";
import imagem from "./facilitador.webp";

const ALTURA = 1.66;
const LARGURA = ALTURA * PROPORCAO_DO_FACILITADOR;

/** Uma mancha radial escura e suave, para a sombra no chão. */
function texturaDaSombra(): THREE.CanvasTexture {
  const tela = document.createElement("canvas");
  tela.width = tela.height = 128;
  const ctx = tela.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(tela);
}

type PersonagemProps = { pose: Pose; parado: boolean };

function Personagem({ pose, parado }: PersonagemProps) {
  const carregada = useLoader(THREE.TextureLoader, imagem);
  const textura = useMemo(() => {
    const t = carregada.clone();
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }, [carregada]);
  const sombra = useMemo(() => texturaDaSombra(), []);
  const figura = useRef<THREE.Group>(null);
  const sombraMalha = useRef<THREE.Mesh>(null);
  const ponteiro = useRef({ x: 0, y: 0 });
  const atual = useRef({ inclina: 0, avanca: 0, segueX: 0, segueY: 0 });

  // O ponteiro vale para a janela inteira (o canvas é pequeno): -1 a 1 em cada eixo.
  useEffect(() => {
    if (parado) return;
    const aoMover = (e: PointerEvent) => {
      ponteiro.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      ponteiro.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", aoMover);
    return () => window.removeEventListener("pointermove", aoMover);
  }, [parado]);

  useFrame((estado, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = estado.clock.elapsedTime;
    const taxa = parado ? 1000 : 6;
    const a = atual.current;
    a.inclina = amortecer(a.inclina, pose.inclina, taxa, dt);
    a.avanca = amortecer(a.avanca, pose.avanca, taxa, dt);
    a.segueX = amortecer(a.segueX, parado ? 0 : ponteiro.current.x * pose.segue, 4, dt);
    a.segueY = amortecer(a.segueY, parado ? 0 : ponteiro.current.y * pose.segue, 4, dt);

    const grupo = figura.current;
    if (!grupo) return;
    const balanco = parado ? 0 : Math.sin(t * pose.balancaFreq) * pose.balanca;
    const sobe = parado ? 0 : Math.abs(Math.sin(t * pose.flutuaFreq * 0.5)) * pose.flutua;
    const pulso = parado ? 0 : Math.sin(t * pose.pulsoFreq) * pose.pulso;
    grupo.rotation.set(-a.segueY * 0.35, a.segueX * 0.55, a.inclina + balanco);
    grupo.position.set(0, sobe, a.avanca);
    grupo.scale.setScalar(1 + pulso);
    if (sombraMalha.current) {
      const afastamento = 1 - sobe * 3;
      sombraMalha.current.scale.set(0.95 * afastamento, 0.22 * afastamento, 1);
    }
  });

  return (
    <>
      <mesh
        ref={sombraMalha}
        position={[0, -ALTURA / 2 - 0.02, 0]}
        rotation={[-Math.PI / 2.4, 0, 0]}
      >
        <planeGeometry args={[LARGURA * 1.6, LARGURA * 1.6]} />
        <meshBasicMaterial map={sombra} transparent depthWrite={false} />
      </mesh>
      <group ref={figura} position={[0, 0, 0]}>
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[LARGURA, ALTURA]} />
          <meshBasicMaterial map={textura} transparent alphaTest={0.02} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}

type Avatar3DCenaProps = {
  estado: EstadoDoAvatar;
  tamanho: number;
  /** Menos movimento: pose direta, sem animação contínua (renderiza só quando a pose muda). */
  parado: boolean;
};

export default function Avatar3DCena({ estado, tamanho, parado }: Avatar3DCenaProps) {
  return (
    <Canvas
      style={{ width: tamanho, height: tamanho / PROPORCAO_DO_FACILITADOR }}
      dpr={[1, 2]}
      frameloop={parado ? "demand" : "always"}
      camera={{ position: [0, 0, 5], fov: 24 }}
      gl={{ alpha: true, antialias: true }}
    >
      <Personagem pose={poses[estado]} parado={parado} />
    </Canvas>
  );
}
