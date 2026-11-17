// Aviso temporário (toast) do MY FLUX. Origem: ideia dos toasts da 21st.dev (21st.dev), escrita do zero.
// Por quê: o aviso de "Colaborador desligado." ficava num quadro no TOPO da página, que quem rolou a
// lista não via. Aqui o aviso aparece perto do polegar, acima da barra inferior e do botão do
// assistente, some sozinho em 7 s (o erro também, mas com a pausa abaixo) e tem botão de fechar.
// Passar o mouse ou focar o aviso PAUSA a contagem, para dar tempo de ler. É um role="status": o
// leitor de tela o anuncia sem tirar o foco de onde a pessoa estava.
import { X } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  mensagem: string;
  aoFechar: () => void;
  duracaoMs?: number;
};

export function AvisoTemporario({ mensagem, aoFechar, duracaoMs = 7000 }: Props) {
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    if (!mensagem || pausado) return;
    const espera = setTimeout(aoFechar, duracaoMs);
    return () => clearTimeout(espera);
  }, [mensagem, pausado, aoFechar, duracaoMs]);

  if (!mensagem) return null;
  return (
    <div
      role="status"
      className="aviso-temporario flex items-start gap-3 rounded-2xl border border-mf-azul/20 bg-white p-3.5 pl-4 text-sm text-mf-texto shadow-[0_12px_32px_-10px_rgb(var(--mf-tinta)/0.35),0_2px_6px_rgb(var(--mf-tinta)/0.08)]"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-mf-azul" />
      <p className="min-w-0 flex-1 break-words leading-5">{mensagem}</p>
      <button
        type="button"
        onClick={aoFechar}
        aria-label="Fechar aviso"
        className="-my-1 -mr-1 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-mf-texto-3 transition-colors hover:bg-slate-100 hover:text-mf-tinta"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
