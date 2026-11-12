import {
  type LabConversaEntrada,
  type LabConversaResposta,
  type LabFonteCitada,
  type LabMensagemDaConversa,
  labConversaLimites,
  labRotuloDoTipoDeFonte
} from "@my-flux/shared";
import type { UseMutationResult } from "@tanstack/react-query";
import { Mic, MicOff, Send, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { cn } from "../../../lib/cn";
import { type ErroDaTela, descreverErro } from "../erros";
import { useAprender, useConversar } from "../hooks";
import { Button, Textarea } from "../ui";
import { mola } from "../ui/movimento";
import { useDitado, textoDoErroDoDitado } from "../voz/ditado";
import { chavesDeVoz, usePreferencia } from "../voz/preferencias";
import { useFala } from "../voz/sintese";
import { AvatarFacilitador3D } from "./avatar-facilitador-3d";
import type { EstadoDoAvatar } from "./avatar-facilitador";
import { Cartao } from "./cartao";

type Textos = {
  titulo: string;
  descricao: string;
  saudacao: string;
  sugestoes: readonly string[];
  placeholder: string;
};

const TEXTOS_DO_RESULTADO: Textos = {
  titulo: "Converse com o facilitador",
  descricao:
    "Tire dúvidas sobre este resultado. O facilitador responde só com base nele, as respostas são geradas automaticamente e a conversa não é guardada. O que vale é a avaliação validada pelo RH.",
  saudacao:
    "Oi! Eu sou o facilitador. Posso comentar o seu resultado: o resumo, o ponto forte, o que desenvolver, os níveis por skill, as sugestões ou uma situação específica. O que você quer saber?",
  sugestoes: [
    "Como fui no geral?",
    "Qual foi o meu ponto forte?",
    "O que devo desenvolver?",
    "Quais são as sugestões para mim?"
  ],
  placeholder: "Pergunte algo sobre o seu resultado..."
};

const TEXTOS_DA_APRENDIZAGEM: Textos = {
  titulo: "Tire dúvidas com o facilitador",
  descricao:
    "Converse sobre gestão de pessoas e de equipes, do jeito que o seu cargo pede. As respostas são geradas automaticamente, citam as fontes quando há e a conversa não é guardada. Nada aqui vale como avaliação.",
  saudacao:
    "Oi! Eu sou o facilitador. Aqui você estuda sem nota: posso explicar conceitos de liderança, mostrar como agir em situações do seu dia a dia e indicar o que vale desenvolver. Sobre o que quer conversar?",
  sugestoes: [
    "Como dar um feedback difícil?",
    "Como delegar sem perder o controle?",
    "O que se espera do meu cargo?",
    "Como priorizar quando tudo é urgente?"
  ],
  placeholder: "Pergunte algo sobre liderança no seu cargo..."
};

/** Quanto o facilitador "fala" (avatar) depois de uma resposta. */
const DURACAO_DA_FALA_MS = 4000;

type Mensagem = {
  id: number;
  papel: LabMensagemDaConversa["papel"];
  texto: string;
  /** Fontes que o facilitador citou (só as que o sistema recuperou). */
  fontes?: readonly LabFonteCitada[];
  /** A Guarda não deixou a mensagem seguir: não volta no histórico. */
  bloqueada?: boolean;
};

type Conversar = UseMutationResult<LabConversaResposta, Error, LabConversaEntrada>;

/**
 * A conversa com o facilitador, depois do resultado. O servidor responde só com base no resultado
 * deste teste e NADA da conversa é guardado: ela vive neste componente e some ao sair da tela. O
 * histórico recente vai junto a cada mensagem para o facilitador acompanhar o fio.
 */
export function ConversaComFacilitador({ sessaoId }: { sessaoId: string }) {
  return <ConversaDoFacilitador conversar={useConversar(sessaoId)} textos={TEXTOS_DO_RESULTADO} />;
}

/** O mesmo facilitador fora do teste: dúvidas de gestão, sem resultado e sem nota. */
export function AprendizagemComFacilitador() {
  return <ConversaDoFacilitador conversar={useAprender()} textos={TEXTOS_DA_APRENDIZAGEM} />;
}

function ConversaDoFacilitador({ conversar, textos }: { conversar: Conversar; textos: Textos }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [falando, setFalando] = useState(false);
  const [erro, setErro] = useState<{ erro: ErroDaTela; mensagem: string } | null>(null);
  const proximoId = useRef(1);
  // Voz (tudo opcional): ler as respostas em voz alta e ditar a mensagem.
  const fala = useFala();
  const [lerRespostas, definirLerRespostas] = usePreferencia(chavesDeVoz.lerRespostas);
  const [cienteDoDitado, definirCienteDoDitado] = usePreferencia(chavesDeVoz.cienteDoDitado);
  const [avisandoDoDitado, setAvisandoDoDitado] = useState(false);
  const baseDoDitado = useRef("");
  const ditado = useDitado((falado) => {
    const base = baseDoDitado.current;
    setTexto(
      `${base}${base !== "" && falado !== "" ? " " : ""}${falado}`.slice(
        0,
        labConversaLimites.mensagem
      )
    );
  });
  const lista = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const elemento = lista.current;
    if (elemento) elemento.scrollTop = elemento.scrollHeight;
  }, [mensagens, conversar.isPending]);

  useEffect(() => {
    if (!falando) return;
    const id = setTimeout(() => setFalando(false), DURACAO_DA_FALA_MS);
    return () => clearTimeout(id);
  }, [falando]);

  const estado: EstadoDoAvatar = conversar.isPending
    ? "refletindo"
    : texto.trim() !== ""
      ? "ouvindo"
      : falando || fala.falando
        ? "falando"
        : "ouvindo";

  function historicoRecente(): LabMensagemDaConversa[] {
    return mensagens
      .filter((m) => !m.bloqueada)
      .slice(-labConversaLimites.historico)
      .map(({ papel, texto: t }) => ({ papel, texto: t }));
  }

  function enviar(mensagem: string) {
    const limpo = mensagem.trim();
    if (limpo === "" || conversar.isPending) return;
    ditado.parar();
    const historico = historicoRecente();
    const doParticipante: Mensagem = {
      id: proximoId.current++,
      papel: "participante",
      texto: limpo
    };
    setMensagens((atuais) => [...atuais, doParticipante]);
    setTexto("");
    setErro(null);
    conversar.mutate(
      { mensagem: limpo, historico },
      {
        onSuccess: (r) => {
          const bloqueada = r.desfecho === "bloqueada";
          setMensagens((atuais) => [
            ...atuais.map((m) =>
              m.id === doParticipante.id && bloqueada ? { ...m, bloqueada } : m
            ),
            {
              id: proximoId.current++,
              papel: "facilitador",
              texto: r.resposta,
              fontes: r.fontes,
              bloqueada
            }
          ]);
          setFalando(true);
          if (lerRespostas) fala.falar(r.resposta);
        },
        onError: (e) => {
          // A pergunta não chegou a ser respondida: sai da lista e volta para a caixa, para tentar de novo.
          setMensagens((atuais) => atuais.filter((m) => m.id !== doParticipante.id));
          setTexto(limpo);
          setErro({ erro: descreverErro(e), mensagem: limpo });
        }
      }
    );
  }

  function alternarDitado() {
    if (ditado.ouvindo) {
      ditado.parar();
      return;
    }
    if (!cienteDoDitado) {
      setAvisandoDoDitado(true);
      return;
    }
    comecarDitado();
  }

  function comecarDitado() {
    fala.parar();
    baseDoDitado.current = texto.trim();
    ditado.iniciar();
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    enviar(texto);
  }

  function aoTeclar(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === "Enter" && !evento.shiftKey && !evento.nativeEvent.isComposing) {
      evento.preventDefault();
      enviar(texto);
    }
  }

  const semConversa = mensagens.length === 0;

  return (
    <Cartao titulo={textos.titulo} descricao={textos.descricao}>
      <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="mx-auto md:mx-0">
          <AvatarFacilitador3D estado={estado} tamanho={112} />
        </div>

        <div className="min-w-0 space-y-4">
          <ol
            ref={lista}
            role="log"
            aria-label="Conversa com o facilitador"
            aria-live="polite"
            className="rolagem-fina max-h-96 space-y-3 overflow-y-auto pr-1"
          >
            <Balao papel="facilitador">{textos.saudacao}</Balao>
            {mensagens.map((m) => (
              <Balao
                key={m.id}
                papel={m.papel}
                aviso={Boolean(m.bloqueada) && m.papel === "facilitador"}
                fontes={m.fontes ?? []}
              >
                {m.texto}
              </Balao>
            ))}
            {conversar.isPending ? (
              <li aria-live="off" className="flex">
                <span
                  role="status"
                  className="rounded-lab-lg rounded-bl-md bg-lab-superficie-3 px-4 py-3 text-lab-pequeno text-lab-tinta-2"
                >
                  <span className="sr-only">O facilitador está escrevendo...</span>
                  <span aria-hidden="true" className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 animate-lab-pontos rounded-full bg-lab-tinta-3 motion-reduce:animate-none"
                        style={{ animationDelay: `${i * 0.18}s` }}
                      />
                    ))}
                  </span>
                </span>
              </li>
            ) : null}
          </ol>

          {semConversa ? (
            <ul aria-label="Sugestões de perguntas" className="flex flex-wrap gap-2">
              {textos.sugestoes.map((s) => (
                <li key={s}>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={conversar.isPending}
                    onClick={() => enviar(s)}
                  >
                    {s}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {erro ? (
            <div
              role="alert"
              className="rounded-lab-md border border-lab-perigo/20 bg-lab-perigo-suave p-3.5 text-lab-pequeno text-lab-perigo-texto"
            >
              <p className="font-semibold">{erro.erro.titulo}</p>
              <p className="mt-0.5">{erro.erro.descricao}</p>
            </div>
          ) : null}

          {fala.suportada ? (
            <label className="flex w-fit cursor-pointer items-center gap-2 text-lab-pequeno text-lab-tinta-2">
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer accent-[rgb(var(--lab-destaque))]"
                checked={lerRespostas}
                onChange={(e) => {
                  definirLerRespostas(e.target.checked);
                  if (!e.target.checked) fala.parar();
                }}
              />
              <Volume2 size={15} aria-hidden="true" />
              Ler as respostas em voz alta
            </label>
          ) : null}

          {avisandoDoDitado ? (
            <div
              role="group"
              aria-label="Aviso sobre o ditado"
              className="space-y-3 rounded-lab-md border border-lab-aviso/20 bg-lab-aviso-suave p-4 text-lab-pequeno leading-6 text-lab-aviso-texto"
            >
              <p>
                O ditado usa o reconhecimento de voz do seu navegador. Em vários navegadores, o
                áudio é processado pelo serviço do fabricante, fora do MY FLUX. O MY FLUX não grava
                áudio, e o texto ditado passa pelo mesmo filtro de dados pessoais das mensagens
                digitadas. Não fale nomes, matrículas nem contatos.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    definirCienteDoDitado(true);
                    setAvisandoDoDitado(false);
                    comecarDitado();
                  }}
                >
                  Entendi, usar o microfone
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAvisandoDoDitado(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}

          {ditado.erro ? (
            <p role="alert" className="text-lab-pequeno text-lab-perigo-texto">
              {textoDoErroDoDitado[ditado.erro]}
            </p>
          ) : null}

          <form onSubmit={aoEnviar} className="space-y-2">
            <label htmlFor="mensagem-ao-facilitador" className="sr-only">
              Sua mensagem ao facilitador
            </label>
            <div className="flex items-end gap-2">
              <Textarea
                id="mensagem-ao-facilitador"
                rows={2}
                maxLength={labConversaLimites.mensagem}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={aoTeclar}
                placeholder={textos.placeholder}
                className="min-h-[3.25rem] flex-1 resize-none"
              />
              {ditado.suportado ? (
                <Button
                  aria-label={ditado.ouvindo ? "Parar o ditado" : "Ditar a mensagem"}
                  aria-pressed={ditado.ouvindo}
                  size="icon"
                  variant={ditado.ouvindo ? "primary" : "secondary"}
                  disabled={conversar.isPending}
                  onClick={alternarDitado}
                  icon={
                    ditado.ouvindo ? (
                      <MicOff size={16} aria-hidden="true" />
                    ) : (
                      <Mic size={16} aria-hidden="true" />
                    )
                  }
                />
              ) : null}
              <Button
                type="submit"
                aria-label="Enviar mensagem"
                loading={conversar.isPending}
                disabled={texto.trim() === ""}
                icon={<Send size={16} aria-hidden="true" />}
              >
                Enviar
              </Button>
            </div>
            <p className="tabular text-lab-legenda text-lab-tinta-2">
              {texto.length}/{labConversaLimites.mensagem}. Não escreva nomes, matrículas nem
              contatos. Enter envia; Shift+Enter quebra a linha.
            </p>
          </form>
        </div>
      </div>
    </Cartao>
  );
}

function Balao({
  papel,
  aviso = false,
  fontes = [],
  children
}: {
  papel: LabMensagemDaConversa["papel"];
  aviso?: boolean;
  fontes?: readonly LabFonteCitada[];
  children: string;
}) {
  const meu = papel === "participante";
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={mola.suave}
      className={cn("flex flex-col gap-1.5", meu ? "items-end" : "items-start")}
    >
      <p
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-lab-lg px-4 py-3 text-lab-pequeno leading-6",
          meu
            ? "rounded-br-md bg-lab-destaque text-white"
            : aviso
              ? "rounded-bl-md border border-lab-aviso/20 bg-lab-aviso-suave text-lab-aviso-texto"
              : "rounded-bl-md bg-lab-superficie-3 text-lab-tinta"
        )}
      >
        <span className="sr-only">{meu ? "Você: " : "Facilitador: "}</span>
        {children}
      </p>
      {fontes.length > 0 ? <FontesCitadas fontes={fontes} /> : null}
    </motion.li>
  );
}

/** Só título, instituição, tipo e link: nunca um trecho da fonte. Link só se for https. */
function FontesCitadas({ fontes }: { fontes: readonly LabFonteCitada[] }) {
  return (
    <ul
      aria-label="Fontes citadas"
      className="max-w-[85%] space-y-1 text-lab-legenda text-lab-tinta-2"
    >
      {fontes.map((f) => (
        <li key={f.id} className="flex flex-wrap items-center gap-x-2">
          <span className="font-medium text-lab-tinta">{f.titulo}</span>
          <span>
            {f.instituicao} · {labRotuloDoTipoDeFonte[f.tipo]}
          </span>
          {f.validada ? null : (
            <span className="text-lab-aviso-texto">(fonte ainda não validada)</span>
          )}
          {f.url !== null && f.url.startsWith("https://") ? (
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lab-destaque underline underline-offset-2"
            >
              abrir fonte<span className="sr-only"> ({f.titulo}), abre em nova aba</span>
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
