import { type LabEscolha, type LabSituacao, labLimiteCaracteresCampoLivre } from "@my-flux/shared";
import { Flag } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Badge, Button } from "../../../components/ui";
import { cn } from "../../../lib/cn";
import { escolhaDaTecla, teclaDaOpcao } from "../rotulos";

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
  aoConfirmar: (escolha: LabEscolha, textoLivre: string) => void;
};

/**
 * Uma situação: o texto, as três opções (também pelas teclas 1, 2 e 3), o campo livre opcional e o
 * botão de confirmar. Escolher não envia: a resposta não pode ser trocada depois, então um toque
 * ou tecla errados não a enviam. Mostra só o que o servidor mandou durante o teste.
 * O pai usa `key={situacao.numero}`, e a escolha e o texto recomeçam a cada situação.
 */
export function SituacaoDoTeste({ situacao, desabilitado, aoConfirmar }: SituacaoDoTesteProps) {
  const [escolha, setEscolha] = useState<LabEscolha | null>(null);
  const [texto, setTexto] = useState("");

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
        {situacao.opcoes.map((opcao) => (
          <label
            key={opcao.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition",
              escolha === opcao.id
                ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-100"
                : "border-slate-200 bg-white hover:border-slate-300",
              desabilitado && "cursor-not-allowed opacity-60"
            )}
          >
            <input
              type="radio"
              name="escolha"
              value={opcao.id}
              checked={escolha === opcao.id}
              onChange={() => setEscolha(opcao.id)}
              className="mt-1 h-4 w-4 shrink-0 accent-emerald-700"
            />
            <span className="flex-1 text-sm leading-6 text-slate-800">
              <span className="mr-2 font-semibold text-slate-950">{opcao.id}.</span>
              {opcao.texto}
            </span>
            <kbd
              aria-hidden="true"
              className="hidden h-6 min-w-6 items-center justify-center rounded border border-slate-300 bg-slate-50 px-1.5 text-xs font-medium text-slate-600 sm:inline-flex"
            >
              {teclaDaOpcao[opcao.id]}
            </kbd>
          </label>
        ))}
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
