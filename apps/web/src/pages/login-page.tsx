// Entrada do sistema. Só apresentação: o formulário, a validação, a chamada /auth/login e a
// navegação são os de sempre. No lado esquerdo, raios de luz em esmeralda (o único fundo animado da
// tela, em CSS puro); no direito, um cartão de vidro com o formulário, sobre o fundo parado.
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
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { BotaoEstrela, FundoAmbiente, Input } from "../components/ui";
import { Brand } from "../components/brand";
import { apiPost, storeSession } from "../services/api-client";

type LoginForm = { email: string; password: string };
type LoginResponse = { data: { accessToken: string; refreshToken: string } };
export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
      // Quem entrou pode não ser quem estava antes (sessão que expirou): descarta o que a tela
      // anterior guardou, como o perfil usado no menu.
      queryClient.clear();
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
        <div className="raios-de-luz" aria-hidden="true" />
        <Brand light />
        <div className="relative z-10 my-auto py-12 lg:py-16">
          <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-mf-realce/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-mf-realce">
            <span className="h-1.5 w-1.5 rounded-full bg-mf-realce" /> Pessoas, planejamento e
            operação
          </span>
          <p className="max-w-lg font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl xl:text-6xl">
            Sua operação.
            <br />
            Conectada.
            <br />
            <span className="text-mf-realce">Em movimento.</span>
          </p>
          <p className="mt-6 max-w-sm text-base leading-7 text-mf-realce-suave/80">
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
                <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-mf-realce/20 bg-white/10">
                  <step.icon size={20} className="text-mf-realce" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium text-white">
                  <span className="mr-1 text-mf-realce/70">0{index + 1}</span> {step.title}
                </p>
                <p className="mt-1 text-xs text-mf-realce/80">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 flex items-center gap-2 text-xs text-mf-realce/80">
          <Check size={14} aria-hidden="true" /> Clareza para decidir. Espaço para crescer.
        </p>
      </section>
      <section className="login-entry relative isolate">
        <FundoAmbiente parado />
        <div className="mb-8 lg:hidden">
          <Brand />
        </div>
        <div className="vidro w-full max-w-[420px] rounded-3xl border border-white/70 p-6 shadow-[0_24px_60px_-24px_rgb(var(--mf-tinta)/0.3),0_2px_8px_rgb(var(--mf-tinta)/0.06)] ring-1 ring-mf-linha/70 sm:p-8">
          <span className="texto-brilho text-xs font-semibold uppercase tracking-[0.14em]">
            Seu espaço de trabalho
          </span>
          <h1 className="texto-gradiente mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Bem-vindo de volta
          </h1>
          <p className="mt-3 text-sm leading-6 text-mf-texto-2">
            Entre na sua conta para continuar de onde parou.
          </p>
          <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
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
                className="pr-14"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                error={errors.password?.message}
                {...register("password", { required: "Informe sua senha." })}
              />
              <button
                type="button"
                className="absolute right-1 top-[29px] grid h-11 w-11 place-items-center rounded-lg text-mf-texto-2 hover:bg-slate-100 hover:text-mf-tinta"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>
            {message && (
              <p
                role="alert"
                className="rounded-xl border border-mf-perigo/20 bg-mf-perigo-suave p-3 text-sm leading-5 text-mf-perigo"
              >
                {message}
              </p>
            )}
            <BotaoEstrela
              envoltorio="w-full"
              className="!h-12 w-full"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> Entrando...
                </>
              ) : (
                <>
                  Entrar no MyFlux <ArrowRight size={18} aria-hidden="true" />
                </>
              )}
            </BotaoEstrela>
          </form>
          <details className="mt-5 text-sm text-mf-texto-2">
            <summary className="min-h-11 cursor-pointer py-3 text-center hover:text-mf-primaria">
              Precisa de ajuda para acessar?
            </summary>
            <p className="mt-1 rounded-xl bg-slate-100 p-3 text-xs leading-5">
              Solicite ao administrador a criação ou recuperação do seu acesso.
            </p>
          </details>
          {import.meta.env.DEV && (
            <details className="demo-access mt-6 rounded-xl border border-mf-linha bg-white p-4">
              <summary className="min-h-11 cursor-pointer py-2.5 text-xs font-medium text-mf-texto-2">
                Explorar com uma conta de demonstração
              </summary>
              <p className="mb-3 mt-1 text-xs leading-5 text-mf-texto-2">
                Escolha um perfil para preencher o acesso local.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {["DEV", "ADMIN", "RH", "COMUM"].map((role) => (
                  <button
                    key={role}
                    type="button"
                    className="min-h-11 rounded-lg border border-mf-linha px-1 py-2 text-xs font-semibold text-mf-primaria hover:border-mf-brilho hover:bg-mf-realce-suave"
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
              <p className="mt-3 text-xs text-mf-texto-2">
                Senha de teste: <code className="font-mono">ChangeMe!2026</code>
              </p>
            </details>
          )}
          <p className="mt-7 flex items-center justify-center gap-2 text-xs text-mf-texto-2">
            <LockKeyhole size={13} aria-hidden="true" /> Acesso individual à sua operação
          </p>
        </div>
        <p className="mt-8 text-xs text-mf-texto-2">MyFlux · Gestão operacional de pessoas</p>
      </section>
    </main>
  );
}
