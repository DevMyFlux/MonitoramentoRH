import { Square, Volume2 } from "lucide-react";
import { useEffect } from "react";
import { Button } from "../ui";
import { useFala } from "../voz/sintese";

/** Lê um texto em voz alta (síntese do navegador). Some sozinho onde o navegador não tem voz. */
export function BotaoOuvir({
  texto,
  rotulo = "Ouvir",
  aoMudar
}: {
  texto: string;
  rotulo?: string;
  /** Avisa quando começa e quando termina de falar (para o avatar acompanhar). */
  aoMudar?: (falando: boolean) => void;
}) {
  const fala = useFala();
  const { falando } = fala;
  useEffect(() => {
    aoMudar?.(falando);
  }, [falando, aoMudar]);
  if (!fala.suportada) return null;
  return (
    <Button
      size="sm"
      variant="secondary"
      aria-pressed={fala.falando}
      icon={
        fala.falando ? (
          <Square size={14} aria-hidden="true" />
        ) : (
          <Volume2 size={16} aria-hidden="true" />
        )
      }
      onClick={() => {
        if (fala.falando) fala.parar();
        else fala.falar(texto);
      }}
    >
      {fala.falando ? "Parar" : rotulo}
    </Button>
  );
}
