import { useState } from "react";
import { Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { Button, Input } from "../components/ui";
import { apiPost } from "../services/api-client";

type ForgotPasswordForm = {
  email: string;
};

export function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const {
    formState: { isSubmitting },
    handleSubmit,
    register
  } = useForm<ForgotPasswordForm>();

  async function onSubmit(values: ForgotPasswordForm) {
    setMessage(null);
    try {
      await apiPost("/auth/forgot-password", values);
      setMessage("Se o e-mail existir, a solicitacao foi registrada.");
    } catch {
      setMessage("API de autenticacao indisponivel neste modo local.");
    }
  }

  return (
    <main className="grid min-h-screen bg-[#07110e] px-4 py-10 text-slate-100 md:place-items-center">
      <section className="mx-auto w-full max-w-md rounded-lg border border-emerald-400/10 bg-slate-950 p-6 shadow-2xl">
        <h1 className="text-xl font-semibold tracking-normal text-white">Recuperar senha</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Informe o e-mail da conta MY FLUX para solicitar redefinição.
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="E-mail" type="email" {...register("email", { required: true })} />
          {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
          <Button
            className="w-full"
            disabled={isSubmitting}
            icon={<Mail size={18} />}
            type="submit"
          >
            Solicitar redefinicao
          </Button>
        </form>
        <Link className="mt-4 block text-sm font-medium text-emerald-300" to="/login">
          Voltar para login
        </Link>
      </section>
    </main>
  );
}
