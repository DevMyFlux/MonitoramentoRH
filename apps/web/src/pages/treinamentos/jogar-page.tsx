// Treinamentos Interativos — o Palco de uma atribuição (/treinamentos/jogar). A cena, as perguntas e a
// conclusão são do <TreinamentoPalco>; esta página só lê a atribuição e fala com a API dos treinamentos.
// Depois de concluir, vai para o resultado. Recarregar não reinicia: lê a tentativa em andamento.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { apiDosTreinamentos, type EstadoDaAtribuicao } from "../../features/treinamentos/api";
import { TreinamentoPalco } from "../../features/treinamentos/palco/treinamento-palco";

const chave = (id: string) => ["treinamentos", "atribuicao", id] as const;

export function JogarPage() {
  const { atribuicaoId = "" } = useParams();
  const consulta = useQuery({
    queryKey: chave(atribuicaoId),
    queryFn: () => apiDosTreinamentos.lerAtribuicao(atribuicaoId),
    retry: false,
    staleTime: Infinity
  });

  if (consulta.isPending)
    return (
      <p className="py-20 text-center text-slate-300" role="status">
        Preparando o palco...
      </p>
    );
  if (consulta.isError)
    return (
      <div role="alert" className="mx-auto max-w-xl py-20 text-center">
        <TriangleAlert className="mx-auto text-[#FBBF24]" aria-hidden="true" />
        <h1 className="mt-3 font-display text-2xl font-bold">
          Não foi possível abrir este treinamento
        </h1>
        <p className="mt-2 text-slate-300">{consulta.error.message}</p>
      </div>
    );
  return <Sessao inicial={consulta.data} />;
}

function Sessao({ inicial }: { inicial: EstadoDaAtribuicao }) {
  const navegar = useNavigate();
  const cache = useQueryClient();
  const atribuicaoId = inicial.atribuicao.id;

  return (
    <TreinamentoPalco
      cenario={inicial.cenario}
      tentativaInicial={inicial.tentativa}
      eyebrow={`Treinamento interativo · ${inicial.atribuicao.turma}`}
      aoIniciar={async () => {
        const estadoNovo = await apiDosTreinamentos.iniciar(atribuicaoId);
        cache.setQueryData(chave(atribuicaoId), estadoNovo);
        return estadoNovo.tentativa;
      }}
      aoResponder={(tentativaId, perguntaId, alternativa) =>
        apiDosTreinamentos.responder(tentativaId, perguntaId, alternativa)
      }
      aoFinalizar={async (tentativaId) => {
        const resultado = await apiDosTreinamentos.concluir(tentativaId);
        cache.setQueryData(["treinamentos", "resultado", tentativaId], resultado);
        void cache.invalidateQueries({ queryKey: ["treinamentos", "minhas"] });
        cache.removeQueries({ queryKey: chave(atribuicaoId) });
        navegar(`/treinamentos/resultado/${tentativaId}`);
      }}
    />
  );
}
