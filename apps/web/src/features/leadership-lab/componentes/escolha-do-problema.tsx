import {
  type LabClassificacao,
  type LabTemaSimulado,
  labLimiteDescricaoDoProblema
} from "@my-flux/shared";
import { Check, FlaskConical, Play, Search } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Badge, Button, MensagemDeErro, Revelar, Textarea } from "../ui";
import { cn } from "../../../lib/cn";
import { type ErroDaTela, descreverErro } from "../erros";
import { useClassificarProblema, useTemasSimulados } from "../hooks";
import { Cartao } from "./cartao";

type EscolhaDoProblemaProps = {
  molde: string;
  iniciando: boolean;
  erroAoIniciar: ErroDaTela | null;
  /** Sem tema, é a demonstração geral (as cinco situações fixas). */
  aoIniciar: (categoriaId?: string) => void;
};

/**
 * "Qual problema você está enfrentando na operação?" (modo demonstração). O participante descreve,
 * o servidor propõe um tema da biblioteca local, e ele confirma. Sem correspondência confiável, a
 * lista de temas aparece para escolha manual: nunca se inventa uma situação fora da biblioteca.
 * O texto só serve para escolher o tema: não é guardado nem enviado a nenhum serviço externo.
 */
export function EscolhaDoProblema({
  molde,
  iniciando,
  erroAoIniciar,
  aoIniciar
}: EscolhaDoProblemaProps) {
  const temas = useTemasSimulados(true);
  const classificar = useClassificarProblema();
  const [descricao, setDescricao] = useState("");
  const [escolhido, setEscolhido] = useState<LabTemaSimulado | null>(null);
  const [resultado, setResultado] = useState<LabClassificacao | null>(null);
  const [verTodos, setVerTodos] = useState(false);

  const todos = temas.data?.temas ?? [];
  const textoValido = descricao.trim().length >= 3;

  function buscar(evento: FormEvent) {
    evento.preventDefault();
    if (!textoValido || classificar.isPending) return;
    classificar.mutate(
      { descricao: descricao.trim() },
      {
        onSuccess: (r) => {
          setResultado(r);
          setEscolhido(r.resultado === "encontrado" ? r.tema : null);
          setVerTodos(false);
        }
      }
    );
  }

  const sugestoes: LabTemaSimulado[] =
    resultado === null || resultado.resultado === "encontrado"
      ? []
      : resultado.resultado === "ambiguo"
        ? resultado.sugestoes
        : resultado.sugestoes;
  const mostrarLista = verTodos || sugestoes.length > 0;
  const lista = verTodos ? todos : sugestoes;

  return (
    <Cartao
      titulo="Qual problema você está enfrentando na operação?"
      descricao={`Teste de ${molde}. Descreva com as suas palavras e escolha o tema da simulação.`}
      acao={
        <Badge tone="info" className="gap-1">
          <FlaskConical size={12} aria-hidden="true" /> Simulação local
        </Badge>
      }
    >
      <form onSubmit={buscar} className="space-y-3">
        <label
          htmlFor="descricao-do-problema"
          className="text-lab-pequeno font-medium text-lab-tinta"
        >
          Descreva o problema
        </label>
        <Textarea
          id="descricao-do-problema"
          rows={3}
          maxLength={labLimiteDescricaoDoProblema}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: Estou com problema para realizar a manutenção do ar-condicionado"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-lab-legenda leading-5 text-lab-tinta-2">
            O que você escreve só serve para escolher o tema. Não é guardado, não vai para nenhuma
            IA nem para serviços externos. A simulação é local e o conteúdo é demonstrativo.
          </p>
          <Button
            type="submit"
            variant="secondary"
            disabled={!textoValido}
            loading={classificar.isPending}
            icon={<Search size={16} aria-hidden="true" />}
          >
            {classificar.isPending ? "Buscando..." : "Buscar simulação"}
          </Button>
        </div>
      </form>

      <div aria-live="polite" className="mt-4 space-y-3">
        {classificar.isError ? (
          <MensagemDeErro>
            {descreverErro(classificar.error).titulo}. Você pode escolher um tema da lista.
          </MensagemDeErro>
        ) : null}
        {resultado?.resultado === "encontrado" ? (
          <p className="text-lab-pequeno text-lab-tinta-2">
            Encontramos este tema para o que você descreveu. Confirme para começar, ou escolha
            outro.
          </p>
        ) : null}
        {resultado?.resultado === "ambiguo" ? (
          <p className="text-lab-pequeno text-lab-tinta-2">
            O que você descreveu combina com mais de um tema. Qual deles é o seu caso?
          </p>
        ) : null}
        {resultado?.resultado === "sem-correspondencia" ? (
          <p className="text-lab-pequeno text-lab-tinta-2">
            Não reconhecemos um tema nesse texto. Escolha um dos temas abaixo.
          </p>
        ) : null}
      </div>

      {escolhido && !mostrarLista ? <TemaEscolhido tema={escolhido} /> : null}

      {mostrarLista ? (
        <ul aria-label="Temas" className="mt-3 grid gap-3 sm:grid-cols-2">
          {lista.map((tema) => (
            <li key={tema.id}>
              <button
                type="button"
                aria-pressed={escolhido?.id === tema.id}
                onClick={() => setEscolhido(tema)}
                className={cn(
                  "flex h-full w-full flex-col rounded-lab-lg border p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-lab hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                  escolhido?.id === tema.id
                    ? "border-lab-destaque bg-lab-destaque-suave shadow-lab-2 ring-1 ring-lab-destaque"
                    : "border-lab-linha bg-lab-superficie shadow-lab-1 hover:border-lab-linha-forte hover:shadow-lab-2"
                )}
              >
                <span className="flex items-center justify-between gap-2 text-lab-pequeno font-semibold text-lab-tinta">
                  {tema.nome}
                  {escolhido?.id === tema.id ? (
                    <Check size={16} className="text-lab-destaque" aria-hidden="true" />
                  ) : null}
                </span>
                <span className="mt-1 text-lab-legenda leading-5 text-lab-tinta-2">
                  {tema.descricao}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {temas.isError ? (
        <MensagemDeErro variante="texto" className="mt-3">
          Não foi possível carregar os temas agora. Tente de novo em instantes.
        </MensagemDeErro>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          disabled={iniciando || escolhido === null}
          onClick={() => escolhido && aoIniciar(escolhido.id)}
          icon={<Play size={16} aria-hidden="true" />}
        >
          {iniciando
            ? "Iniciando..."
            : escolhido
              ? `Iniciar: ${escolhido.nome}`
              : "Iniciar simulação"}
        </Button>
        {verTodos ? null : (
          <Button variant="ghost" disabled={todos.length === 0} onClick={() => setVerTodos(true)}>
            Escolher um tema da lista
          </Button>
        )}
        <Button variant="ghost" disabled={iniciando} onClick={() => aoIniciar()}>
          Fazer a demonstração geral
        </Button>
      </div>
      {erroAoIniciar ? (
        <MensagemDeErro className="mt-3">
          {erroAoIniciar.titulo}. {erroAoIniciar.descricao}
        </MensagemDeErro>
      ) : null}
    </Cartao>
  );
}

function TemaEscolhido({ tema }: { tema: LabTemaSimulado }) {
  return (
    <Revelar className="mt-3 rounded-lab-lg border border-lab-destaque bg-lab-destaque-suave p-5 ring-1 ring-lab-destaque">
      <p className="text-lab-legenda font-semibold text-lab-destaque-texto">Tema</p>
      <p className="mt-1 text-lab-h3 text-lab-tinta">{tema.nome}</p>
      <p className="mt-1 text-lab-pequeno leading-6 text-lab-tinta-2">{tema.descricao}</p>
    </Revelar>
  );
}
