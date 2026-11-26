// O indicador da IA para ADMIN e DEV (GET /suporte/status): diz se o assistente responde e, quando
// não, o que conferir. O teste e as cenas não dependem dela.
import { useQuery } from "@tanstack/react-query";
import { request } from "../../my-flux/client";

type Estado = "ok" | "desatualizado" | "indisponivel" | "desligado";

const ROTULOS: Record<Estado, string> = {
  ok: "IA disponível",
  desatualizado: "IA desatualizada",
  indisponivel: "IA indisponível",
  desligado: "IA desligada"
};

export function SaudeDaIa() {
  const consulta = useQuery({
    queryKey: ["suporte", "status"],
    queryFn: () => request<{ estado: Estado; detalhe: string | null }>("/suporte/status"),
    retry: false
  });
  return (
    <p
      role="status"
      aria-label="Situação da IA"
      className="rounded-lab-md border border-lab-borda p-4 text-lab-pequeno text-lab-tinta-2"
    >
      {consulta.isPending ? (
        "Verificando a IA..."
      ) : consulta.isError ? (
        "Não foi possível verificar a IA agora."
      ) : (
        <>
          <strong className="text-lab-tinta">{ROTULOS[consulta.data.estado]}</strong>
          {consulta.data.detalhe ? `. ${consulta.data.detalhe}` : null}
        </>
      )}
    </p>
  );
}
