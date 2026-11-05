import type { LabPersonagem } from "@my-flux/shared";
import type { ReactNode } from "react";
import { cn } from "../../../lib/cn";
import { nomeDoPersonagem } from "../rotulos";

type Visual = { pele: string; cabelo: string; roupa: string; fundo: string; extra: ReactNode };

/**
 * Cada personagem é só um cargo, nunca uma pessoa real: pele, cabelo, roupa e um acessório que
 * diz o papel (capacete, prancheta, jaleco...). Tudo é SVG e vem pronto: nada é gerado por IA.
 */
const visuais: Record<LabPersonagem, Visual> = {
  tecnico: {
    pele: "#d9a77f",
    cabelo: "#3b2f2a",
    roupa: "#ea580c",
    fundo: "#ffedd5",
    extra: (
      <>
        <path d="M33 44c0-14 11-22 27-22s27 8 27 22z" fill="#facc15" />
        <rect x="30" y="43" width="60" height="5" rx="2.5" fill="#eab308" />
        <rect x="76" y="92" width="14" height="22" rx="3" fill="#475569" />
        <path d="M78 92v-6h10v6" fill="none" stroke="#cbd5e1" strokeWidth="2" />
      </>
    )
  },
  supervisor: {
    pele: "#eab994",
    cabelo: "#1f2937",
    roupa: "#0f766e",
    fundo: "#ccfbf1",
    extra: (
      <>
        <rect
          x="74"
          y="88"
          width="24"
          height="30"
          rx="3"
          fill="#f8fafc"
          stroke="#94a3b8"
          strokeWidth="1.5"
        />
        <rect x="82" y="85" width="8" height="5" rx="1.5" fill="#64748b" />
        <path d="M78 98h16M78 104h16M78 110h10" stroke="#94a3b8" strokeWidth="1.5" />
      </>
    )
  },
  "responsavel-assistencial": {
    pele: "#c68e66",
    cabelo: "#292524",
    roupa: "#f8fafc",
    fundo: "#e0f2fe",
    extra: (
      <>
        <path d="M44 84c-4 14 2 24 10 24s12-8 12-18" fill="none" stroke="#475569" strokeWidth="3" />
        <circle cx="54" cy="110" r="4" fill="#94a3b8" />
        <path d="M60 84v34" stroke="#cbd5e1" strokeWidth="2" />
      </>
    )
  },
  "coordenador-contrato": {
    pele: "#eab994",
    cabelo: "#44403c",
    roupa: "#1e3a8a",
    fundo: "#dbeafe",
    extra: (
      <>
        <path d="M54 84l6 14 6-14" fill="#f8fafc" />
        <path d="M60 90l-3 6 3 16 3-16z" fill="#b91c1c" />
        <rect x="76" y="96" width="22" height="16" rx="2.5" fill="#78350f" />
        <rect
          x="83"
          y="93"
          width="8"
          height="5"
          rx="2"
          fill="none"
          stroke="#78350f"
          strokeWidth="2"
        />
      </>
    )
  },
  "engenharia-clinica": {
    pele: "#d9a77f",
    cabelo: "#111827",
    roupa: "#e0f2fe",
    fundo: "#cffafe",
    extra: (
      <>
        <rect x="70" y="92" width="26" height="20" rx="3" fill="#0f172a" />
        <rect x="73" y="95" width="20" height="14" rx="1.5" fill="#22d3ee" />
        <path d="M76 102h6l2-4 3 7 2-3h4" fill="none" stroke="#0f172a" strokeWidth="1.5" />
      </>
    )
  },
  enfermagem: {
    pele: "#eab994",
    cabelo: "#78350f",
    roupa: "#0d9488",
    fundo: "#ccfbf1",
    extra: (
      <>
        <path d="M38 30c4-10 14-14 22-14s18 4 22 14c-8-4-14-5-22-5s-14 1-22 5z" fill="#f8fafc" />
        <path d="M58 76l2 8 2-8" fill="none" stroke="#f8fafc" strokeWidth="2.5" />
        <rect
          x="76"
          y="94"
          width="20"
          height="14"
          rx="2.5"
          fill="#f8fafc"
          stroke="#94a3b8"
          strokeWidth="1.5"
        />
        <path d="M86 97v8M82 101h8" stroke="#dc2626" strokeWidth="2.5" />
      </>
    )
  },
  fornecedor: {
    pele: "#c68e66",
    cabelo: "#1c1917",
    roupa: "#7c3aed",
    fundo: "#ede9fe",
    extra: (
      <>
        <path d="M33 38c0-12 11-18 27-18s27 6 27 18z" fill="#f8fafc" />
        <path d="M60 20v18" stroke="#7c3aed" strokeWidth="3" />
        <rect
          x="72"
          y="94"
          width="26"
          height="22"
          rx="2"
          fill="#d6a76b"
          stroke="#a16207"
          strokeWidth="1.5"
        />
        <path d="M72 102h26" stroke="#a16207" strokeWidth="1.5" />
      </>
    )
  },
  diretoria: {
    pele: "#d9a77f",
    cabelo: "#9ca3af",
    roupa: "#1e293b",
    fundo: "#e2e8f0",
    extra: (
      <>
        <path d="M52 84l8 16 8-16" fill="#f8fafc" />
        <path d="M60 92l-2.5 5 2.5 14 2.5-14z" fill="#0f766e" />
        <rect
          x="42"
          y="49"
          width="14"
          height="10"
          rx="3"
          fill="none"
          stroke="#0f172a"
          strokeWidth="2"
        />
        <rect
          x="64"
          y="49"
          width="14"
          height="10"
          rx="3"
          fill="none"
          stroke="#0f172a"
          strokeWidth="2"
        />
        <path d="M56 54h8" stroke="#0f172a" strokeWidth="2" />
      </>
    )
  },
  "seguranca-trabalho": {
    pele: "#eab994",
    cabelo: "#1f2937",
    roupa: "#facc15",
    fundo: "#fef9c3",
    extra: (
      <>
        <path
          d="M33 44c0-14 11-22 27-22s27 8 27 22z"
          fill="#f8fafc"
          stroke="#cbd5e1"
          strokeWidth="1.5"
        />
        <rect x="30" y="43" width="60" height="5" rx="2.5" fill="#e2e8f0" />
        <path d="M44 84l-4 34M76 84l4 34" stroke="#f8fafc" strokeWidth="5" />
        <path d="M78 98h18v14H78z" fill="#16a34a" />
        <path d="M82 105l3 3 6-7" fill="none" stroke="#f8fafc" strokeWidth="2" />
      </>
    )
  },
  "controle-infeccao": {
    pele: "#d9a77f",
    cabelo: "#292524",
    roupa: "#7e22ce",
    fundo: "#f3e8ff",
    extra: (
      <>
        <path
          d="M44 56q16 18 32 0v12q-16 10-32 0z"
          fill="#e0f2fe"
          stroke="#7dd3fc"
          strokeWidth="1.5"
        />
        <path d="M42 54h-6M84 54h-6" stroke="#7dd3fc" strokeWidth="1.5" />
        <circle cx="86" cy="100" r="9" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" />
        <path d="M86 94v12M80 100h12" stroke="#7e22ce" strokeWidth="2.5" />
      </>
    )
  }
};

type PersonagemProps = { personagem: LabPersonagem; tamanho?: number; className?: string };

/** A ilustração de quem aparece na cena. O nome do papel também vai em texto, para leitor de tela. */
export function Personagem({ personagem, tamanho = 96, className }: PersonagemProps) {
  const v = visuais[personagem];
  const camuflado = personagem === "tecnico" || personagem === "seguranca-trabalho";
  return (
    <svg
      role="img"
      aria-label={`Em cena: ${nomeDoPersonagem[personagem]}`}
      data-personagem={personagem}
      viewBox="0 0 120 120"
      width={tamanho}
      height={tamanho}
      className={cn("shrink-0", className)}
    >
      <circle cx="60" cy="60" r="58" fill={v.fundo} />
      <path d="M16 120c2-25 20-37 44-37s42 12 44 37z" fill={v.roupa} />
      <rect x="52" y="68" width="16" height="18" rx="6" fill={v.pele} />
      <ellipse cx="60" cy="52" rx="25" ry="28" fill={v.pele} />
      {camuflado ? null : (
        <path
          d="M34 50c0-19 11-29 26-29s26 10 26 29c-5-9-13-13-26-13S39 41 34 50z"
          fill={v.cabelo}
        />
      )}
      <circle cx="49" cy="52" r="3" fill="#0f172a" />
      <circle cx="71" cy="52" r="3" fill="#0f172a" />
      <path
        d="M53 65q7 5 14 0"
        fill="none"
        stroke="#7f1d1d"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {v.extra}
    </svg>
  );
}
