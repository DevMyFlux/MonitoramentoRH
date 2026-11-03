import { ArrowRight, FlaskConical } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui";

/** A faixa do painel quando o servidor está em modo demonstração (LAB_MODO_DEMO). */
export function FaixaDeDemonstracao() {
  return (
    <div
      role="note"
      className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"
    >
      <FlaskConical size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p>
        <strong>Modo demonstração.</strong> As situações e a avaliação dos testes são de exemplo,
        escritas só para mostrar as telas, e não são o teste real. Os números do resultado são
        calculados de verdade a partir das suas escolhas, mas não valem como avaliação.
      </p>
    </div>
  );
}

/**
 * Para quem entrou por outro perfil (no modo de teste todo visitante entra como DEV): como chegar ao
 * teste. Só quem é participante (perfil COMUM) faz o teste.
 */
export function DicaDaContaDeParticipante() {
  return (
    <div className="mx-auto max-w-xl space-y-3 text-center text-sm leading-6 text-slate-600">
      <p>
        Neste ambiente de teste, para fazer o teste entre com a conta de participante{" "}
        <strong className="font-semibold text-slate-900">comum@myflux.local</strong> (a mesma senha
        de demonstração das outras contas).
      </p>
      <Link to="/login" className="inline-block">
        <Button icon={<ArrowRight size={16} aria-hidden="true" />}>Ir para o login</Button>
      </Link>
    </div>
  );
}
