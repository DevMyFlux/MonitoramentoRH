import { type LabEscolha, type LabSituacao, labLimiteCaracteresCampoLivre } from "@my-flux/shared";
import { Check, Flag, Loader2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Badge, Button } from "../../../components/ui";
import { cn } from "../../../lib/cn";
import { escolhaDaTecla, teclaDaOpcao } from "../rotulos";
import type { EstadoDoAvatar } from "./avatar-facilitador";
import { CenaDaSituacao } from "./cena-da-situacao";

/** Onde digitar um número é digitar, não escolher uma opção. Radio e checkbox não contam. */
function ehCampoDeTexto(alvo: EventTarget | null): boolean {
  if (alvo instanceof HTMLTextAreaElement) return true;
  if (alvo instanceof HTMLInputElement) {
    return !["radio", "checkbox", "button", "submit"].includes(alvo.type);
  }
  return alvo instanceof HTMLElement && alvo.isContentEditable;
}

type SituacaoDoTesteProps = {
  situacao: LabSituacao;
  /** Enquanto uma resposta é enviada, ou depois que o tempo acabou: nada pode ser alterado. */
  desabilitado: boolean;
  /** Uma resposta está indo para o servidor: a opção escolhida mostra o carregamento. */
  enviando?: boolean;
  aoConfirmar: (escolha: LabEscolha, textoLivre: string) => void;
};

/**
 * Uma situação: o texto, as três opções (também pelas teclas 1, 2 e 3), o campo livre opcional e o
 * botão de confirmar. Escolher não envia: a resposta não pode ser trocada depois, então um toque
 * ou tecla errados não a enviam. Mostra só o que o servidor mandou durante o teste.
 * O pai usa `key={situacao.numero}`, e a escolha e o texto recomeçam a cada situação.
 */
export function SituacaoDoTeste({
  situacao,
  desabilitado,
  enviando = false,
  aoConfirmar
}: SituacaoDoTesteProps) {
  const [escolha, setEscolha] = useState<LabEscolha | null>(null);
  const [texto, setTexto] = useState("");
  // Logo que a situação chega com uma consequência, o facilitador "mostra o que aconteceu".
  const [feedbackAtivo, setFeedbackAtivo] = useState(situacao.consequencia !== null);

  useEffect(() => {
    if (!feedbackAtivo) return;
    const id = setTimeout(() => setFeedbackAtivo(false), 4000);
    return () => clearTimeout(id);
  }, [feedbackAtivo]);

  const estadoDoAvatar: EstadoDoAvatar = desabilitado
    ? "refletindo"
    : escolha !== null
      ? "ouvindo"
      : feedbackAtivo
        ? "feedback"
        : "falando";

  useEffect(() => {
    if (desabilitado) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.ctrlKey || evento.metaKey || evento.altKey || ehCampoDeTexto(evento.target))
        return;
      const letra = escolhaDaTecla[evento.key];
      if (letra) setEscolha(letra);
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [desabilitado]);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (escolha !== null && !desabilitado) aoConfirmar(escolha, texto);
  }

  return (
    <form onSubmit={enviar} className="space-y-6">
      <CenaDaSituacao cena={situacao.cena ?? null} estado={estadoDoAvatar} />
      <div className="space-y-3">
        {situacao.marco ? (
          <Badge tone="warning" className="gap-1">
            <Flag size={12} aria-hidden="true" /> Situação de marco
          </Badge>
        ) : null}
        <p className="text-lg leading-8 text-slate-900">{situacao.texto}</p>
      </div>

      <fieldset disabled={desabilitado} className="space-y-3">
        <legend className="mb-3 text-sm font-medium text-slate-700">
          O que você faz?{" "}
          <span className="font-normal text-slate-500">
            Escolha com o mouse ou tecle 1, 2 ou 3.
          </span>
        </legend>
        {situacao.opcoes.map((opcao) => {
          const selecionada = escolha === opcao.id;
          return (
            <label
              key={opcao.id}
              className={cn(
                "relative flex cursor-pointer items-start gap-4 rounded-2xl border-2 p-4 transition duration-200 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-emerald-200 motion-reduce:transition-none",
                selecionada
                  ? "border-emerald-600 bg-emerald-50 shadow-md"
                  : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md motion-reduce:hover:translate-y-0",
                desabilitado &&
                  "cursor-not-allowed opacity-70 hover:translate-y-0 hover:shadow-none"
              )}
            >
              <input
                type="radio"
                name="escolha"
                value={opcao.id}
                checked={selecionada}
                onChange={() => setEscolha(opcao.id)}
                className="sr-only"
              />
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors",
                  selecionada ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-700"
                )}
              >
                {opcao.id}
                <span className="sr-only">.</span>
              </span>
              <span className="flex-1 text-sm leading-6 text-slate-800">{opcao.texto}</span>
              {selecionada && enviando ? (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-800">
                  <Loader2
                    size={16}
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  Enviando...
                </span>
              ) : selecionada ? (
                <Check size={18} className="mt-1 text-emerald-700" aria-hidden="true" />
              ) : (
                <kbd
                  aria-hidden="true"
                  className="hidden h-6 min-w-6 items-center justify-center rounded border border-slate-300 bg-slate-50 px-1.5 text-xs font-medium text-slate-600 sm:inline-flex"
                >
                  {teclaDaOpcao[opcao.id]}
                </kbd>
              )}
            </label>
          );
        })}
      </fieldset>

      <div>
        <label htmlFor="texto-livre" className="text-sm font-medium text-slate-700">
          O que mais você faria?{" "}
          <span className="font-normal text-slate-500">Opcional, e sem relógio próprio.</span>
        </label>
        <textarea
          id="texto-livre"
          rows={3}
          maxLength={labLimiteCaracteresCampoLivre}
          value={texto}
          disabled={desabilitado}
          onChange={(e) => setTexto(e.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 disabled:opacity-60"
          placeholder="Escreva só se quiser acrescentar algo à opção escolhida."
        />
        <p className="mt-1 text-xs text-slate-500">
          {texto.length}/{labLimiteCaracteresCampoLivre}
        </p>
      </div>

      <Button type="submit" disabled={desabilitado || escolha === null}>
        Confirmar resposta
      </Button>
    </form>
  );
}
