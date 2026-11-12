import { useState } from "react";
import { Button, Marcacao, MensagemDeErro } from "../ui";
import type { ErroDaTela } from "../erros";
import { Cartao } from "./cartao";

type TermoDeCienciaProps = {
  versao: string;
  aceitando: boolean;
  erro: ErroDaTela | null;
  aoAceitar: () => void;
};

/**
 * O termo de ciência do primeiro acesso.
 *
 * O TEXTO COMPLETO DO TERMO AINDA NÃO EXISTE: é decisão do RH e do jurídico (finalidade, quem
 * acessa os resultados, retenção). Aqui entra só um resumo do que o sistema faz, que já está
 * decidido, e o aviso de que o texto é provisório. Quando o texto definitivo existir, ele
 * substitui o resumo e a versão do termo (`labTermoVersaoAtual`) muda, o que pede novo aceite.
 */
export function TermoDeCiencia({ versao, aceitando, erro, aoAceitar }: TermoDeCienciaProps) {
  const [li, setLi] = useState(false);
  return (
    <Cartao
      titulo="Termo de ciência"
      descricao="Leia antes de fazer o primeiro teste do Leadership Lab."
    >
      <div className="space-y-3 text-lab-pequeno leading-6 text-lab-tinta-2">
        <p>O que acontece quando você faz um teste:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Você responde a situações do dia a dia de um gestor. Suas escolhas e o tempo de cada
            resposta ficam registrados.
          </li>
          <li>
            As situações e a avaliação das suas escolhas são geradas com apoio de inteligência
            artificial. Nenhum dado pessoal seu (nome, matrícula, e-mail) é enviado a ela.
          </li>
          <li>
            O resultado só passa a fazer parte do seu histórico oficial depois de validado pelo RH.
            Até lá ele aparece com o selo &quot;Aguardando validação&quot;.
          </li>
        </ul>
        <p
          role="note"
          className="rounded-lab-md border border-lab-aviso/20 bg-lab-aviso-suave p-3.5 text-lab-legenda leading-5 text-lab-aviso-texto"
        >
          Texto provisório (versão {versao}): o termo completo ainda será definido pelo RH e pelo
          jurídico.
        </p>
      </div>
      <div className="mt-5 grid gap-4">
        <label className="flex cursor-pointer items-start gap-3 text-lab-pequeno font-medium text-lab-tinta">
          <Marcacao className="mt-0.5" checked={li} onChange={(e) => setLi(e.target.checked)} />
          <span>Li e estou ciente.</span>
        </label>
        {erro ? (
          <MensagemDeErro>
            {erro.titulo}. {erro.descricao}
          </MensagemDeErro>
        ) : null}
        <div>
          <Button loading={aceitando} disabled={!li} onClick={aoAceitar}>
            {aceitando ? "Registrando..." : "Aceitar e continuar"}
          </Button>
        </div>
      </div>
    </Cartao>
  );
}
