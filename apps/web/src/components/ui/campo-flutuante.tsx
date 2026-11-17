// Campos com rótulo flutuante. Origem: inspirados nos "floating label inputs" da galeria Uiverse
// (uiverse.io), escritos do zero com Tailwind (peer + placeholder vazio), sem copiar código.
// Por quê: o rótulo fica sempre visível (em repouso dentro do campo, ao digitar sobe) e economiza
// altura no celular. Foco esmeralda (borda de 2 px + halo suave), alvo de 48 px, erro e ajuda
// ligados por aria-describedby. Campos de data/mês e a seleção já nascem com o rótulo no alto.
import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "../../lib/cn";

const base =
  "peer block w-full rounded-xl border border-mf-linha bg-white px-3.5 pb-1.5 pt-5 text-sm text-mf-tinta outline-none transition-[border-color,box-shadow] duration-150 hover:border-mf-texto-3/50 focus:border-mf-brilho focus:shadow-[0_0_0_3px_rgb(var(--mf-brilho)/0.22)] focus-visible:outline-none disabled:opacity-60 aria-[invalid=true]:border-mf-perigo aria-[invalid=true]:focus:shadow-[0_0_0_3px_rgb(var(--mf-perigo)/0.18)]";

const rotuloBase =
  "pointer-events-none absolute left-3.5 origin-left text-mf-texto-3 transition-all duration-150 peer-focus:text-mf-primaria motion-reduce:transition-none";

function Obrigatorio({ ligado }: { ligado?: boolean | undefined }) {
  return ligado ? <span className="text-mf-perigo"> *</span> : null;
}

type CampoDeTextoProps = {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  tipo?: string;
  obrigatorio?: boolean;
  ajuda?: ReactNode;
  erro?: string;
  tamanhoMaximo?: number;
  className?: string;
};

export function CampoDeTexto({
  rotulo,
  valor,
  aoMudar,
  tipo = "text",
  obrigatorio,
  ajuda,
  erro,
  tamanhoMaximo,
  className
}: CampoDeTextoProps) {
  const id = useId();
  // Data e mês mostram um formato mesmo vazios: o rótulo não pode ficar por cima.
  const fixo = tipo === "date" || tipo === "month" || tipo === "time";
  const descricao = erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined;
  return (
    <div className={className}>
      <div className="relative">
        <input
          id={id}
          type={tipo}
          value={valor}
          maxLength={tamanhoMaximo}
          required={obrigatorio}
          placeholder=" "
          aria-invalid={erro ? true : undefined}
          aria-describedby={descricao}
          onChange={(e) => aoMudar(e.target.value)}
          className={cn(base, "h-[3.25rem]")}
        />
        <label
          htmlFor={id}
          className={cn(
            rotuloBase,
            fixo
              ? "top-1.5 text-[11px] font-medium"
              : "top-1.5 text-[11px] font-medium peer-placeholder-shown:top-[0.95rem] peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:font-medium"
          )}
        >
          {rotulo}
          <Obrigatorio ligado={obrigatorio} />
        </label>
      </div>
      {erro ? (
        <p id={`${id}-erro`} role="alert" className="mt-1 text-xs text-mf-perigo">
          {erro}
        </p>
      ) : ajuda ? (
        <p id={`${id}-ajuda`} className="mt-1 text-xs leading-4 text-mf-texto-3">
          {ajuda}
        </p>
      ) : null}
    </div>
  );
}

type CampoDeSelecaoProps = {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  opcoes: { value: string; label: string }[];
  obrigatorio?: boolean;
  className?: string;
};

export function CampoDeSelecao({
  rotulo,
  valor,
  aoMudar,
  opcoes,
  obrigatorio,
  className
}: CampoDeSelecaoProps) {
  const id = useId();
  return (
    <div className={cn("relative", className)}>
      <select
        id={id}
        value={valor}
        required={obrigatorio}
        onChange={(e) => aoMudar(e.target.value)}
        className={cn(base, "h-[3.25rem] cursor-pointer appearance-none pr-9")}
      >
        {opcoes.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <label htmlFor={id} className={cn(rotuloBase, "top-1.5 text-[11px] font-medium")}>
        {rotulo}
        <Obrigatorio ligado={obrigatorio} />
      </label>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mf-texto-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
