import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import { BotaoEstrela, FundoAmbiente, Input } from "../components/ui";
import { apiPost } from "../services/api-client";

type SetPasswordForm = {
  password: string;
};

export function SetPasswordPage() {
  const [params] = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const {
    formState: { isSubmitting },
    handleSubmit,
    register
  } = useForm<SetPasswordForm>();
  const token = params.get("token") ?? "";
  const mode = params.get("mode") === "reset" ? "reset" : "invite";

  async function onSubmit(values: SetPasswordForm) {
    setMessage(null);
    try {
      await apiPost(mode === "reset" ? "/auth/reset-password" : "/auth/accept-invitation", {
        token,
        password: values.password
      });
      setMessage("Senha definida com sucesso.");
    } catch {
      setMessage("A autenticação está indisponível neste modo local.");
    }
  }

  return (
    <main className="relative isolate grid min-h-screen bg-mf-fundo px-4 py-10 md:place-items-center">
      <FundoAmbiente />
      <section className="vidro mx-auto w-full max-w-md rounded-3xl border border-white/70 p-6 shadow-[0_24px_60px_-24px_rgb(var(--mf-tinta)/0.3)] ring-1 ring-mf-linha/70 sm:p-8">
        <h1 className="texto-gradiente font-display text-3xl font-bold tracking-tight">
          Definir senha
        </h1>
        <p className="mt-2 text-sm leading-6 text-mf-texto-2">
          Crie uma senha segura para acessar o MyFlux.
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Nova senha" type="password" {...register("password", { required: true })} />
          {message ? (
            <p role="status" className="rounded-xl bg-mf-realce-suave p-3 text-sm text-mf-primaria">
              {message}
            </p>
          ) : null}
          <BotaoEstrela
            envoltorio="w-full"
            className="w-full"
            disabled={isSubmitting || !token}
            icon={<KeyRound size={18} aria-hidden="true" />}
            type="submit"
          >
            Salvar senha
          </BotaoEstrela>
        </form>
        <Link
          className="mt-4 flex min-h-11 items-center text-sm font-medium text-mf-primaria hover:underline"
          to="/login"
        >
          Ir para login
        </Link>
      </section>
    </main>
  );
}
