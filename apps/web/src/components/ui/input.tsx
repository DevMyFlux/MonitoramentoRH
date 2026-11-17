import { useId, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  helperText?: string | undefined;
  error?: string | undefined;
};

export function Input({ className, error, helperText, id, label, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? props.name ?? generatedId;

  // A mensagem de erro/ajuda fica FORA do <label>: dentro, ela entrava no nome acessível do campo
  // ("E-mail Informe seu e-mail.") e o leitor de tela lia tudo junto com o rótulo.
  return (
    <div className="grid gap-2">
      <label className="grid gap-2 text-sm font-medium text-mf-texto" htmlFor={inputId}>
        <span>
          {label}
          {props.required && (
            <span aria-hidden="true" className="ml-1 text-mf-perigo">
              *
            </span>
          )}
        </span>
        <input
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error || helperText ? `${inputId}-hint` : undefined}
          className={cn(
            "h-12 w-full min-w-0 rounded-xl border border-mf-linha bg-white px-3.5 text-sm font-normal text-mf-tinta outline-none transition-[border-color,box-shadow] placeholder:text-mf-texto-3 hover:border-mf-texto-3/50 focus:border-mf-brilho focus:shadow-[0_0_0_3px_rgb(var(--mf-brilho)/0.22)]",
            error &&
              "border-mf-perigo focus:border-mf-perigo focus:shadow-[0_0_0_3px_rgb(var(--mf-perigo)/0.18)]",
            className
          )}
          {...props}
        />
      </label>
      {error ? (
        <span id={`${inputId}-hint`} role="alert" className="text-xs font-normal text-mf-perigo">
          {error}
        </span>
      ) : helperText ? (
        <span id={`${inputId}-hint`} className="text-xs font-normal text-mf-texto-2">
          {helperText}
        </span>
      ) : null}
    </div>
  );
}
