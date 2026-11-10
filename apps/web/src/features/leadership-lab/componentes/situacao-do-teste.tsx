import { type LabEscolha, type LabSituacao, labLimiteCaracteresCampoLivre } from "@my-flux/shared";
import { Check, Flag, Loader2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Badge, Button, Textarea } from "../ui";
import { mola } from "../ui/movimento";
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
    <form onSubmit={enviar} className="space-y-7">
      <CenaDaSituacao cena={situacao.cena ?? null} estado={estadoDoAvatar} />
      <div className="space-y-3">
        {situacao.marco ? (
          <Badge tone="warning" className="gap-1">
            <Flag size={12} aria-hidden="true" /> Situação de marco
          </Badge>
        ) : null}
        <p className="text-[1.25rem] font-medium leading-8 tracking-[-0.012em] text-lab-tinta">
          {situacao.texto}
        </p>
      </div>

      <fieldset disabled={desabilitado} className="space-y-3">
        <legend className="mb-3 text-lab-pequeno font-medium text-lab-tinta">
          O que você faz?{" "}
          <span className="font-normal text-lab-tinta-2">
            Escolha com o mouse ou tecle 1, 2 ou 3.
          </span>
        </legend>
        {situacao.opcoes.map((opcao) => {
          const selecionada = escolha === opcao.id;
          return (
            <motion.label
              key={opcao.id}
              {...(desabilitado ? {} : { whileHover: { y: -2 }, whileTap: { scale: 0.995 } })}
              transition={mola.viva}
              className={cn(
                "relative flex cursor-pointer items-start gap-4 rounded-lab-lg border p-5 transition-[border-color,background-color,box-shadow] duration-lab has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-lab-destaque/20 motion-reduce:transition-none",
                selecionada
                  ? "border-lab-destaque bg-lab-destaque-suave shadow-lab-2 ring-1 ring-lab-destaque"
                  : "border-lab-linha bg-lab-superficie shadow-lab-1 hover:border-lab-linha-forte hover:shadow-lab-2",
                desabilitado && "cursor-not-allowed opacity-70"
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
                  "grid h-9 w-9 shrink-0 place-items-center rounded-full text-lab-pequeno font-semibold transition-colors duration-lab",
                  selecionada
                    ? "bg-lab-destaque text-white"
                    : "bg-lab-superficie-3 text-lab-tinta-2"
                )}
              >
                {`${opcao.id}.`}
              </span>
              <span className="flex-1 pt-1 text-lab-corpo leading-6 text-lab-tinta">
                {opcao.texto}
              </span>
              {selecionada && enviando ? (
                <span className="flex items-center gap-1.5 pt-1 text-lab-legenda font-medium text-lab-destaque-texto">
                  <Loader2
                    size={16}
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  Enviando...
                </span>
              ) : selecionada ? (
                <motion.span
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={mola.viva}
                  className="mt-1.5 text-lab-destaque"
                >
                  <Check size={18} aria-hidden="true" />
                </motion.span>
              ) : (
                <kbd
                  aria-hidden="true"
                  className="mt-1 hidden h-6 min-w-6 items-center justify-center rounded-lab-sm border border-lab-linha-forte bg-lab-superficie-2 px-1.5 text-lab-legenda font-medium text-lab-tinta-2 sm:inline-flex"
                >
                  {teclaDaOpcao[opcao.id]}
                </kbd>
              )}
            </motion.label>
          );
        })}
      </fieldset>

      <div>
        <label htmlFor="texto-livre" className="text-lab-pequeno font-medium text-lab-tinta">
          O que mais você faria?{" "}
          <span className="font-normal text-lab-tinta-2">Opcional, e sem relógio próprio.</span>
        </label>
        <Textarea
          id="texto-livre"
          rows={3}
          maxLength={labLimiteCaracteresCampoLivre}
          value={texto}
          disabled={desabilitado}
          onChange={(e) => setTexto(e.target.value)}
          className="mt-2"
          placeholder="Escreva só se quiser acrescentar algo à opção escolhida."
        />
        <p className="tabular mt-1.5 text-lab-legenda text-lab-tinta-2">
          {texto.length}/{labLimiteCaracteresCampoLivre}
        </p>
      </div>

      <Button type="submit" size="lg" disabled={desabilitado || escolha === null}>
        Confirmar resposta
      </Button>
    </form>
  );
}
