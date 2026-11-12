import type { LabAcaoDoPainel } from "@my-flux/shared";
import { labSituacaoDoMarco } from "@my-flux/shared";
import { Play } from "lucide-react";
import { BotaoLink, Button, MensagemDeErro } from "../ui";
import type { ErroDaTela } from "../erros";
import { motivoDeIndisponibilidade } from "../rotulos";
import { CartaoDeTreinamento } from "./cartao-de-treinamento";
import { EscolhaDoProblema } from "./escolha-do-problema";
import { MapaDoCaminho } from "./mapa-do-caminho";

type AcaoDoPainelProps = {
  acao: LabAcaoDoPainel;
  iniciando: boolean;
  erroAoIniciar: ErroDaTela | null;
  /** Modo demonstração: o participante descreve o problema e escolhe o tema da simulação local. */
  demonstracao?: boolean;
  /** `categoriaId` só vem na simulação local; sem ele, é o teste como sempre. */
  aoIniciar: (categoriaId?: string) => void;
};

/** O botão do painel, no estado que o servidor decidiu (as mesmas regras de POST /sessoes). */
export function AcaoDoPainel({
  acao,
  iniciando,
  erroAoIniciar,
  demonstracao = false,
  aoIniciar
}: AcaoDoPainelProps) {
  if (acao.tipo === "continuar") {
    return (
      <CartaoDeTreinamento
        eyebrow="Em andamento"
        titulo="Você tem um teste em andamento"
        descricao={`Você parou na situação ${acao.situacaoAtual} de ${acao.totalSituacoes} (${acao.molde.nome}). O tempo de cada situação não para enquanto você está fora.`}
        lateral={
          <MapaDoCaminho
            total={acao.totalSituacoes}
            atual={acao.situacaoAtual}
            marco={labSituacaoDoMarco}
            compacto
          />
        }
        acao={
          <BotaoLink to="/lab/teste" size="lg" icon={<Play size={16} aria-hidden="true" />}>
            Continuar teste
          </BotaoLink>
        }
      />
    );
  }

  if (acao.tipo === "indisponivel") {
    const motivo = motivoDeIndisponibilidade[acao.motivo];
    return (
      <CartaoDeTreinamento
        tom="neutro"
        eyebrow="Indisponível agora"
        titulo={motivo.titulo}
        descricao={motivo.descricao(acao.limiteDiario)}
        acao={
          <Button size="lg" disabled icon={<Play size={16} aria-hidden="true" />}>
            Iniciar teste
          </Button>
        }
      />
    );
  }

  if (demonstracao) {
    return (
      <EscolhaDoProblema
        molde={acao.molde.nome}
        iniciando={iniciando}
        erroAoIniciar={erroAoIniciar}
        aoIniciar={aoIniciar}
      />
    );
  }

  return (
    <CartaoDeTreinamento
      eyebrow="Próximo treinamento"
      titulo="Pronto para o próximo teste"
      descricao={`Teste de ${acao.molde.nome}. Cada situação tem um tempo limite, que começa a contar assim que ela aparece na tela.`}
      acao={
        <Button
          size="lg"
          loading={iniciando}
          onClick={() => aoIniciar()}
          icon={<Play size={16} aria-hidden="true" />}
        >
          {iniciando ? "Iniciando..." : "Iniciar teste"}
        </Button>
      }
    >
      {erroAoIniciar ? (
        <MensagemDeErro className="mt-4">
          {erroAoIniciar.titulo}. {erroAoIniciar.descricao}
        </MensagemDeErro>
      ) : null}
    </CartaoDeTreinamento>
  );
}
