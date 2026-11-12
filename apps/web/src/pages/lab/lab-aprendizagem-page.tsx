import { ArrowLeft } from "lucide-react";
import { BotaoLink, CabecalhoDePagina, Escalonar, Revelar } from "../../features/leadership-lab/ui";
import { AprendizagemComFacilitador } from "../../features/leadership-lab/componentes/conversa-com-facilitador";

/**
 * O espaço de aprendizagem: o facilitador tira dúvidas de gestão fora do teste. O backend recusa a
 * conversa enquanto há um teste em andamento (o facilitador nunca dá pista numa situação
 * cronometrada); a tela mostra o motivo.
 */
export function LabAprendizagemPage() {
  return (
    <Escalonar className="mx-auto max-w-4xl space-y-8">
      <Revelar>
        <CabecalhoDePagina
          eyebrow="Leadership Lab"
          titulo="Espaço de aprendizagem"
          descricao="Estude com o facilitador, sem nota e sem relógio. Ele conhece o que o seu cargo cobra e o seu histórico resumido, e cita as fontes quando usa alguma."
        />
      </Revelar>
      <Revelar>
        <AprendizagemComFacilitador />
      </Revelar>
      <Revelar>
        <BotaoLink to="/lab" variant="secondary" icon={<ArrowLeft size={16} aria-hidden="true" />}>
          Voltar ao painel
        </BotaoLink>
      </Revelar>
    </Escalonar>
  );
}
