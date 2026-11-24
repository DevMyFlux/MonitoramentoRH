// O semáforo de aptidão de uma pessoa: verde/amarelo/vermelho, sempre com ícone e palavra, e os
// motivos na dica. Vermelho ganha a "borda elétrica" (ideia do Electric Border do React Bits,
// reactbits.dev, escrita em CSS em styles.css), parada com reduzir movimento.
//
// A API calcula a aptidão por pessoa; o chip só pergunta quando a linha aparece na tela (e guarda
// a resposta por 5 min), para uma lista longa não disparar tudo de uma vez.
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, OctagonAlert, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Dica } from "../../components/ui/dica";
import { cn } from "../../lib/cn";
import { request } from "../my-flux/client";
import { ehAptidao, motivosDaAptidao, rotuloDaAptidao, type CorDaAptidao } from "./aptidao";

const visual: Record<CorDaAptidao, { icone: typeof CircleCheck; classe: string }> = {
  GREEN: {
    icone: CircleCheck,
    classe: "bg-mf-realce-suave text-mf-primaria ring-mf-realce"
  },
  YELLOW: {
    icone: TriangleAlert,
    classe: "bg-mf-alerta-suave text-mf-alerta ring-mf-alerta/25"
  },
  RED: {
    icone: OctagonAlert,
    classe: "borda-eletrica border bg-mf-perigo-suave text-mf-perigo ring-mf-perigo/25"
  }
};

/** Fica verdadeiro quando o elemento entra na tela (ou de cara, sem IntersectionObserver). */
function useApareceu<T extends Element>() {
  const ref = useRef<T>(null);
  const [apareceu, setApareceu] = useState(
    () => typeof window === "undefined" || typeof window.IntersectionObserver !== "function"
  );
  useEffect(() => {
    if (apareceu || !ref.current) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) setApareceu(true);
      },
      { rootMargin: "200px" }
    );
    observador.observe(ref.current);
    return () => observador.disconnect();
  }, [apareceu]);
  return { ref, apareceu };
}

export function ChipDeAptidao({ employeeId }: { employeeId: string }) {
  const { ref, apareceu } = useApareceu<HTMLSpanElement>();
  const consulta = useQuery({
    queryKey: ["aptidao", employeeId],
    queryFn: () => request<unknown>(`/employees/${employeeId}/aptitude`),
    enabled: apareceu,
    staleTime: 5 * 60_000,
    retry: false
  });
  const aptidao = ehAptidao(consulta.data) ? consulta.data : null;

  if (!aptidao) {
    return (
      <span ref={ref} className="text-xs text-mf-texto-3">
        {consulta.isPending && apareceu ? (
          <span
            className="inline-block h-6 w-16 animate-pulse rounded-full bg-mf-linha/70 motion-reduce:animate-none"
            aria-label="Carregando aptidão"
          />
        ) : (
          <span aria-label="Aptidão indisponível">—</span>
        )}
      </span>
    );
  }

  const { icone: Icone, classe } = visual[aptidao.status];
  const rotulo = rotuloDaAptidao[aptidao.status];
  return (
    <span ref={ref}>
      <Dica texto={`${rotulo}: ${motivosDaAptidao(aptidao)}`} className="no-underline">
        <span
          className={cn(
            "inline-flex min-h-6 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
            classe
          )}
        >
          <Icone size={13} aria-hidden="true" />
          {rotulo}
        </span>
      </Dica>
    </span>
  );
}
