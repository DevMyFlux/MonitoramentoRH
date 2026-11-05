import {
  type LabClassificacao,
  type LabTemaSimulado,
  labLimiteDescricaoDoProblema
} from "@my-flux/shared";
import { Check, FlaskConical, Play, Search } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Badge, Button } from "../../../components/ui";
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
        <label htmlFor="descricao-do-problema" className="text-sm font-medium text-slate-700">
          Descreva o problema
        </label>
        <textarea
          id="descricao-do-problema"
          rows={3}
          maxLength={labLimiteDescricaoDoProblema}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: Estou com problema para realizar a manutenção do ar-condicionado"
          className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-xs leading-5 text-slate-500">
            O que você escreve só serve para escolher o tema. Não é guardado, não vai para nenhuma
            IA nem para serviços externos. A simulação é local e o conteúdo é demonstrativo.
          </p>
          <Button
            type="submit"
            variant="secondary"
            disabled={!textoValido || classificar.isPending}
            icon={<Search size={16} aria-hidden="true" />}
          >
            {classificar.isPending ? "Buscando..." : "Buscar simulação"}
          </Button>
        </div>
      </form>

      <div aria-live="polite" className="mt-4 space-y-3">
        {classificar.isError ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {descreverErro(classificar.error).titulo}. Você pode escolher um tema da lista.
          </p>
        ) : null}
        {resultado?.resultado === "encontrado" ? (
          <p className="text-sm text-slate-700">
            Encontramos este tema para o que você descreveu. Confirme para começar, ou escolha
            outro.
          </p>
        ) : null}
        {resultado?.resultado === "ambiguo" ? (
          <p className="text-sm text-slate-700">
            O que você descreveu combina com mais de um tema. Qual deles é o seu caso?
          </p>
        ) : null}
        {resultado?.resultado === "sem-correspondencia" ? (
          <p className="text-sm text-slate-700">
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
                  "flex h-full w-full flex-col rounded-xl border-2 p-3 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 motion-reduce:transition-none",
                  escolhido?.id === tema.id
                    ? "border-emerald-600 bg-emerald-50 shadow-md"
                    : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md motion-reduce:hover:translate-y-0"
                )}
              >
                <span className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-950">
                  {tema.nome}
                  {escolhido?.id === tema.id ? (
                    <Check size={16} className="text-emerald-700" aria-hidden="true" />
                  ) : null}
                </span>
                <span className="mt-1 text-xs leading-5 text-slate-600">{tema.descricao}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {temas.isError ? (
        <p role="alert" className="mt-3 text-sm text-red-800">
          Não foi possível carregar os temas agora. Tente de novo em instantes.
        </p>
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
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {erroAoIniciar.titulo}. {erroAoIniciar.descricao}
        </p>
      ) : null}
    </Cartao>
  );
}

function TemaEscolhido({ tema }: { tema: LabTemaSimulado }) {
  return (
    <div className="mt-3 animate-lab-entrada rounded-xl border-2 border-emerald-600 bg-emerald-50 p-4 motion-reduce:animate-none">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Tema</p>
      <p className="mt-1 text-base font-semibold text-slate-950">{tema.nome}</p>
      <p className="mt-1 text-sm leading-6 text-slate-700">{tema.descricao}</p>
    </div>
  );
}
