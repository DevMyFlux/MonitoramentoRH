import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import { Button, Input } from "../components/ui";
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
      setMessage("API de autenticacao indisponivel neste modo local.");
    }
  }

  return (
    <main className="grid min-h-screen bg-[#07110e] px-4 py-10 text-slate-100 md:place-items-center">
      <section className="mx-auto w-full max-w-md rounded-lg border border-emerald-400/10 bg-slate-950 p-6 shadow-2xl">
        <h1 className="text-xl font-semibold tracking-normal text-white">Definir senha</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Crie uma senha segura para acessar banca, historico e preferencias.
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Nova senha" type="password" {...register("password", { required: true })} />
          {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
          <Button
            className="w-full"
            disabled={isSubmitting || !token}
            icon={<KeyRound size={18} />}
            type="submit"
          >
            Salvar senha
          </Button>
        </form>
        <Link className="mt-4 block text-sm font-medium text-emerald-300" to="/login">
          Ir para login
        </Link>
      </section>
    </main>
  );
}
