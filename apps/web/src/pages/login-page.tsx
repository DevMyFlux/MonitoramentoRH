import { useState } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Layers2,
  LoaderCircle,
  LockKeyhole,
  Users,
  CalendarDays
} from "lucide-react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Button, Input } from "../components/ui";
import { Brand } from "../components/brand";
import { apiPost, storeSession } from "../services/api-client";

type LoginForm = { email: string; password: string };
type LoginResponse = { data: { accessToken: string; refreshToken: string } };
export function LoginPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    formState: { isSubmitting, errors },
    handleSubmit,
    register,
    setValue
  } = useForm<LoginForm>();
  async function onSubmit(values: LoginForm) {
    setMessage(null);
    try {
      const response = await apiPost<LoginResponse, LoginForm>("/auth/login", values);
      storeSession(response.data.accessToken, response.data.refreshToken);
      navigate("/");
    } catch {
      setMessage(
        "Não foi possível entrar. Confira seus dados e tente novamente. Se o problema continuar, procure o administrador."
      );
    }
  }
  return (
    <main className="login-layout">
      <section className="login-story">
        <Brand light />
        <div className="relative z-10 my-auto py-12 lg:py-16">
          <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-emerald-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Pessoas, planejamento e
            operação
          </span>
          <h1 className="max-w-lg text-4xl font-medium leading-[1.12] tracking-tight sm:text-5xl xl:text-6xl">
            Sua operação.
            <br />
            Conectada.
            <br />
            <span className="text-emerald-200">Em movimento.</span>
          </h1>
          <p className="mt-6 max-w-sm text-base leading-7 text-emerald-50/70">
            Do planejamento à escala, um só lugar para cuidar das pessoas e acompanhar cada etapa.
          </p>
          <div
            className="flow-preview mt-10"
            aria-label="Fluxo: planejar, conectar pessoas e organizar escalas"
          >
            {[
              { icon: Layers2, title: "Planejar", description: "QLP e posições" },
              { icon: Users, title: "Conectar", description: "Pessoas e talentos" },
              { icon: CalendarDays, title: "Organizar", description: "Escalas e equipes" }
            ].map((step, index) => (
              <div key={step.title} className="relative z-10">
                <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-emerald-100/20 bg-[#164d43]">
                  <step.icon size={20} className="text-emerald-100" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium text-white">
                  <span className="mr-1 text-emerald-200/60">0{index + 1}</span> {step.title}
                </p>
                <p className="mt-1 text-xs text-emerald-100/60">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 flex items-center gap-2 text-xs text-emerald-100/65">
          <Check size={14} /> Clareza para decidir. Espaço para crescer.
        </p>
      </section>
      <section className="login-entry">
        <div className="mb-10 lg:hidden">
          <Brand />
        </div>
        <div className="w-full max-w-[400px]">
          <span className="eyebrow">SEU ESPAÇO DE TRABALHO</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Bem-vindo de volta
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Entre na sua conta para continuar de onde parou.
          </p>
          <form className="mt-9 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Input
              label="E-mail"
              placeholder="voce@empresa.com.br"
              type="email"
              autoComplete="username"
              error={errors.email?.message}
              {...register("email", {
                required: "Informe seu e-mail.",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Informe um e-mail válido."
                }
              })}
            />
            <div className="relative">
              <Input
                label="Senha"
                placeholder="Digite sua senha"
                className="pr-12"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                error={errors.password?.message}
                {...register("password", { required: "Informe sua senha." })}
              />
              <button
                type="button"
                className="absolute right-2 top-[31px] rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {message && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700"
              >
                {message}
              </p>
            )}
            <Button className="!h-12 w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <>
                  <LoaderCircle className="animate-spin" size={18} /> Entrando...
                </>
              ) : (
                <>
                  Entrar no MyFlux <ArrowRight size={18} />
                </>
              )}
            </Button>
          </form>
          <details className="mt-5 text-sm text-slate-500">
            <summary className="cursor-pointer text-center hover:text-emerald-800">
              Precisa de ajuda para acessar?
            </summary>
            <p className="mt-3 rounded-xl bg-slate-100 p-3 text-xs leading-5">
              Solicite ao administrador a criação ou recuperação do seu acesso.
            </p>
          </details>
          {import.meta.env.DEV && (
            <details className="demo-access mt-9 rounded-xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer text-xs font-medium text-slate-600">
                Explorar com uma conta de demonstração
              </summary>
              <p className="mb-3 mt-3 text-xs leading-5 text-slate-500">
                Escolha um perfil para preencher o acesso local.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {["DEV", "ADMIN", "RH", "COMUM"].map((role) => (
                  <button
                    key={role}
                    type="button"
                    className="rounded-lg border border-slate-200 px-1 py-2 text-xs font-semibold text-emerald-800 hover:border-emerald-400 hover:bg-emerald-50"
                    onClick={() => {
                      setValue("email", `${role.toLowerCase()}@myflux.local`, {
                        shouldValidate: true
                      });
                      setValue("password", "ChangeMe!2026", { shouldValidate: true });
                      setMessage(null);
                    }}
                  >
                    {role}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Senha de teste: <code>ChangeMe!2026</code>
              </p>
            </details>
          )}
          <p className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
            <LockKeyhole size={13} /> Acesso individual à sua operação
          </p>
        </div>
        <p className="mt-10 text-xs text-slate-400">MyFlux · Gestão operacional de pessoas</p>
      </section>
    </main>
  );
}
