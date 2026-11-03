import type { LabAcaoDoPainel } from "@my-flux/shared";
import { Play } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui";
import type { ErroDaTela } from "../erros";
import { motivoDeIndisponibilidade } from "../rotulos";
import { Cartao } from "./cartao";

type AcaoDoPainelProps = {
  acao: LabAcaoDoPainel;
  iniciando: boolean;
  erroAoIniciar: ErroDaTela | null;
  aoIniciar: () => void;
};

/** O botão do painel, no estado que o servidor decidiu (as mesmas regras de POST /sessoes). */
export function AcaoDoPainel({ acao, iniciando, erroAoIniciar, aoIniciar }: AcaoDoPainelProps) {
  if (acao.tipo === "continuar") {
    return (
      <Cartao titulo="Você tem um teste em andamento">
        <p className="text-sm leading-6 text-slate-600">
          Você parou na situação {acao.situacaoAtual} de {acao.totalSituacoes} ({acao.molde.nome}).
          O tempo de cada situação não para enquanto você está fora.
        </p>
        <Link to="/lab/teste" className="mt-4 inline-block">
          <Button icon={<Play size={16} aria-hidden="true" />}>Continuar teste</Button>
        </Link>
      </Cartao>
    );
  }

  if (acao.tipo === "indisponivel") {
    const motivo = motivoDeIndisponibilidade[acao.motivo];
    return (
      <Cartao titulo={motivo.titulo}>
        <p className="text-sm leading-6 text-slate-600">{motivo.descricao(acao.limiteDiario)}</p>
        <Button className="mt-4" disabled icon={<Play size={16} aria-hidden="true" />}>
          Iniciar teste
        </Button>
      </Cartao>
    );
  }

  return (
    <Cartao titulo="Pronto para o próximo teste">
      <p className="text-sm leading-6 text-slate-600">
        Teste de {acao.molde.nome}. Cada situação tem um tempo limite, que começa a contar assim que
        ela aparece na tela.
      </p>
      {erroAoIniciar ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {erroAoIniciar.titulo}. {erroAoIniciar.descricao}
        </p>
      ) : null}
      <Button
        className="mt-4"
        disabled={iniciando}
        onClick={aoIniciar}
        icon={<Play size={16} aria-hidden="true" />}
      >
        {iniciando ? "Iniciando..." : "Iniciar teste"}
      </Button>
    </Cartao>
  );
}
