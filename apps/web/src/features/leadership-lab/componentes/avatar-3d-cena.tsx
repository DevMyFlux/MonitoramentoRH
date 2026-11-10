// Leadership Lab — o facilitador em 3D (three.js via @react-three/fiber). Personagem procedural:
// o mesmo mascote do avatar 2D (gota preta, boné, camiseta com o Ø), montado com formas simples,
// sem modelo externo. Carregado sob demanda por `avatar-facilitador-3d.tsx`.
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { EstadoDoAvatar } from "./avatar-facilitador";
import { amortecer, type Pose, poses } from "./avatar-poses";

const PRETO = "#111827";
const CAMISETA = "#1f2937";
const PELE = "#f2c9a0";
const BRANCO = "#f8fafc";

type PecaProps = { pose: Pose; parada: boolean };

/** A cabeça em gota: um perfil girado em torno do eixo Y. */
function geometriaDaGota(): THREE.LatheGeometry {
  const pontos: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    // Largo embaixo, afunila para cima até uma ponta suave.
    const raio = 0.36 * Math.sin(Math.PI * Math.pow(t, 0.75)) * (1 - 0.25 * t);
    pontos.push(new THREE.Vector2(Math.max(raio, 0.001), t * 0.72 - 0.25));
  }
  return new THREE.LatheGeometry(pontos, 40);
}

function Personagem({ pose, parada }: PecaProps) {
  const corpo = useRef<THREE.Group>(null);
  const cabeca = useRef<THREE.Group>(null);
  const braco = useRef<THREE.Group>(null);
  const antebraco = useRef<THREE.Group>(null);
  const polegar = useRef<THREE.Mesh>(null);
  const boca = useRef<THREE.Mesh>(null);
  const olhos = useRef<THREE.Group>(null);
  const atual = useRef({ ...pose, abertura: pose.boca });
  const gota = useMemo(() => geometriaDaGota(), []);

  useFrame((estado, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = estado.clock.elapsedTime;
    const a = atual.current;
    // Parado (menos movimento): vai direto à pose, sem animação contínua.
    const taxa = parada ? 1000 : 7;
    a.bracoX = amortecer(a.bracoX, pose.bracoX, taxa, dt);
    a.bracoZ = amortecer(a.bracoZ, pose.bracoZ, taxa, dt);
    a.cotovelo = amortecer(a.cotovelo, pose.cotovelo, taxa, dt);
    a.cabecaZ = amortecer(a.cabecaZ, pose.cabecaZ, taxa, dt);
    a.cabecaX = amortecer(a.cabecaX, pose.cabecaX, taxa, dt);
    a.largura = amortecer(a.largura, pose.largura, taxa, dt);

    const respira = parada ? 0 : Math.sin(t * 1.8) * 0.012;
    const flutua = parada || !pose.flutua ? 0 : 0.05 + Math.sin(t * 2.2) * 0.04;
    if (corpo.current) corpo.current.position.y = respira + flutua;
    if (cabeca.current) {
      cabeca.current.rotation.z = a.cabecaZ;
      cabeca.current.rotation.x = a.cabecaX;
    }
    if (braco.current) {
      braco.current.rotation.x = a.bracoX;
      braco.current.rotation.z = a.bracoZ;
    }
    if (antebraco.current) antebraco.current.rotation.x = -a.cotovelo;
    if (polegar.current) polegar.current.visible = pose.polegar;
    if (boca.current) {
      const abertura =
        pose.fala && !parada
          ? 0.04 + Math.abs(Math.sin(t * 11)) * pose.boca * 0.22
          : pose.boca * 0.22;
      a.abertura = amortecer(a.abertura, abertura, parada ? 1000 : 25, dt);
      boca.current.scale.set(0.07 * a.largura, Math.max(0.012, a.abertura * 0.5), 0.03);
    }
    if (olhos.current) {
      // Piscar a cada ~4 s.
      const fase = parada ? 0 : t % 4;
      olhos.current.scale.y = fase > 3.85 ? 0.1 : 1;
    }
  });

  return (
    <group ref={corpo}>
      {/* pernas e tênis */}
      {[-0.1, 0.1].map((x) => (
        <group key={x} position={[x, 0.42, 0]}>
          <mesh position={[0, -0.05, 0]}>
            <capsuleGeometry args={[0.065, 0.3, 6, 12]} />
            <meshStandardMaterial color={PRETO} roughness={0.5} />
          </mesh>
          <mesh position={[0, -0.34, 0.04]}>
            <boxGeometry args={[0.15, 0.08, 0.26]} />
            <meshStandardMaterial color={CAMISETA} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.395, 0.04]}>
            <boxGeometry args={[0.16, 0.03, 0.27]} />
            <meshStandardMaterial color={BRANCO} roughness={0.7} />
          </mesh>
        </group>
      ))}
      {/* shorts e camiseta */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.2, 24]} />
        <meshStandardMaterial color={PRETO} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.78, 0]} scale={[1, 1, 0.78]}>
        <capsuleGeometry args={[0.2, 0.26, 8, 24]} />
        <meshStandardMaterial color={CAMISETA} roughness={0.6} />
      </mesh>
      {/* o Ø da camiseta */}
      <group position={[0, 0.78, 0.165]}>
        <mesh>
          <torusGeometry args={[0.055, 0.008, 12, 32]} />
          <meshStandardMaterial color={BRANCO} />
        </mesh>
        <mesh rotation={[0, 0, -0.9]}>
          <boxGeometry args={[0.15, 0.012, 0.01]} />
          <meshStandardMaterial color={BRANCO} />
        </mesh>
      </group>

      {/* braço de trás, relaxado */}
      <group position={[0.24, 0.96, 0]} rotation={[0, 0, -0.14]}>
        <mesh position={[0, -0.17, 0]}>
          <capsuleGeometry args={[0.052, 0.22, 6, 12]} />
          <meshStandardMaterial color={PRETO} roughness={0.5} />
        </mesh>
      </group>
      {/* braço da frente: ombro, antebraço (cotovelo), mão e polegar */}
      <group ref={braco} position={[-0.24, 0.96, 0]}>
        <mesh position={[0, -0.14, 0]}>
          <capsuleGeometry args={[0.052, 0.18, 6, 12]} />
          <meshStandardMaterial color={PRETO} roughness={0.5} />
        </mesh>
        <group ref={antebraco} position={[0, -0.28, 0]}>
          <mesh position={[0, -0.12, 0]}>
            <capsuleGeometry args={[0.048, 0.14, 6, 12]} />
            <meshStandardMaterial color={PRETO} roughness={0.5} />
          </mesh>
          <mesh position={[0, -0.27, 0]}>
            <sphereGeometry args={[0.062, 16, 16]} />
            <meshStandardMaterial color={PRETO} roughness={0.5} />
          </mesh>
          <mesh ref={polegar} position={[0, -0.34, 0.01]} visible={false}>
            <capsuleGeometry args={[0.022, 0.07, 4, 8]} />
            <meshStandardMaterial color={PRETO} roughness={0.5} />
          </mesh>
        </group>
      </group>

      {/* cabeça em gota, com rosto, olhos, boca e boné */}
      <group ref={cabeca} position={[0, 1.08, 0]}>
        <mesh geometry={gota} position={[0, 0.05, 0]}>
          <meshStandardMaterial color={PRETO} roughness={0.32} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.22, 0.2]} scale={[1, 1.05, 0.55]}>
          <sphereGeometry args={[0.23, 32, 32]} />
          <meshStandardMaterial color={PELE} roughness={0.7} />
        </mesh>
        <group ref={olhos} position={[0, 0.26, 0.31]}>
          {[-0.075, 0.075].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <sphereGeometry args={[0.024, 16, 16]} />
              <meshStandardMaterial color={PRETO} roughness={0.2} />
            </mesh>
          ))}
        </group>
        <mesh ref={boca} position={[0, 0.15, 0.335]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.6} />
        </mesh>
        {/* boné: calota achatada e aba para a frente */}
        <mesh position={[0, 0.37, 0]} scale={[1.08, 0.62, 1.08]} rotation={[0.06, 0, 0]}>
          <sphereGeometry args={[0.28, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={CAMISETA} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.375, 0.29]} rotation={[0.18, 0, 0]}>
          <boxGeometry args={[0.36, 0.022, 0.2]} />
          <meshStandardMaterial color={PRETO} roughness={0.5} />
        </mesh>
      </group>
    </group>
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
      style={{ width: tamanho, height: tamanho * 1.3 }}
      dpr={[1, 2]}
      frameloop={parado ? "demand" : "always"}
      camera={{ position: [0, 0.95, 4.2], fov: 30 }}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ camera }) => camera.lookAt(0, 0.85, 0)}
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[2.5, 4, 5]} intensity={2.4} />
      <directionalLight position={[-3, 2, -2]} intensity={0.8} color="#bfe6d4" />
      <Personagem pose={poses[estado]} parada={parado} />
    </Canvas>
  );
}
