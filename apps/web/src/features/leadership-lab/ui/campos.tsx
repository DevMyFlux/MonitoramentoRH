import { ChevronDown } from "lucide-react";
import {
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from "react";
import { cn } from "../../../lib/cn";

/** A aparência comum dos campos de texto: borda fina, foco com anel suave da cor de destaque. */
export const classeDoCampo =
  "w-full min-w-0 rounded-lab-md border border-lab-linha-forte bg-lab-superficie text-lab-corpo text-lab-tinta outline-none transition duration-lab-rapida placeholder:text-lab-tinta-3 hover:border-lab-tinta-3/70 focus:border-lab-destaque focus:shadow-[0_0_0_3px_rgb(var(--lab-destaque)/0.22)] disabled:cursor-not-allowed disabled:bg-lab-superficie-3 disabled:opacity-70";

const classeDoErro =
  "border-lab-perigo hover:border-lab-perigo focus:border-lab-perigo focus:shadow-[0_0_0_3px_rgb(var(--lab-perigo)/0.18)]";

/**
 * Rótulo flutuante (como nos formulários do resto do MY FLUX): em repouso o rótulo fica dentro do
 * campo; ao focar ou digitar, sobe e encolhe. O texto de exemplo (placeholder) só aparece com o foco,
 * para não ficar por cima do rótulo. Data, mês e hora mostram um formato mesmo vazios: lá o rótulo
 * já nasce no alto.
 */
const classeDoRotuloFlutuante =
  "pointer-events-none absolute left-3.5 origin-left text-lab-tinta-3 transition-all duration-lab-rapida peer-focus:text-lab-destaque-texto motion-reduce:transition-none";
const noAlto = "top-1.5 text-lab-legenda font-medium";
const noRepouso =
  "top-1.5 text-lab-legenda font-medium peer-placeholder-shown:top-3 peer-placeholder-shown:text-lab-corpo peer-placeholder-shown:font-normal peer-focus:top-1.5 peer-focus:text-lab-legenda peer-focus:font-medium";
const tiposComFormato = ["date", "month", "time", "datetime-local", "week"];

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  helperText?: string | undefined;
  error?: string | undefined;
};

export function Input({ className, error, helperText, id, label, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? props.name ?? generatedId;
  const fixo = tiposComFormato.includes(props.type ?? "text");
  const { placeholder, ...resto } = props;

  // A mensagem de erro/ajuda fica FORA do rótulo: dentro dele, entrava no nome acessível do campo.
  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error || helperText ? `${inputId}-hint` : undefined}
          placeholder={placeholder ?? " "}
          className={cn(
            classeDoCampo,
            "peer h-[3.25rem] px-3.5 pb-1.5 pt-5 placeholder:text-transparent focus:placeholder:text-lab-tinta-3",
            error && classeDoErro,
            className
          )}
          {...resto}
        />
        <label htmlFor={inputId} className={cn(classeDoRotuloFlutuante, fixo ? noAlto : noRepouso)}>
          {label}
          {props.required && (
            <span aria-hidden="true" className="ml-1 text-lab-perigo">
              *
            </span>
          )}
        </label>
      </div>
      {error ? (
        <span
          id={`${inputId}-hint`}
          role="alert"
          className="text-lab-legenda font-normal text-lab-perigo-texto"
        >
          {error}
        </span>
      ) : helperText ? (
        <span id={`${inputId}-hint`} className="text-lab-legenda font-normal text-lab-tinta-2">
          {helperText}
        </span>
      ) : null}
    </div>
  );
}

type SelectOption = {
  label: string;
  value: string;
};

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: SelectOption[];
  error?: string;
};

export function Select({ className, error, id, label, options, ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? props.name ?? generatedId;

  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${selectId}-hint` : undefined}
          className={cn(
            classeDoCampo,
            "peer h-[3.25rem] cursor-pointer appearance-none pb-1.5 pl-3.5 pr-10 pt-5",
            error && classeDoErro,
            className
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label htmlFor={selectId} className={cn(classeDoRotuloFlutuante, noAlto)}>
          {label}
        </label>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-lab-tinta-3"
        />
      </div>
      {error ? (
        <span
          id={`${selectId}-hint`}
          role="alert"
          className="text-lab-legenda font-normal text-lab-perigo-texto"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** Área de texto com a aparência dos demais campos. O rótulo fica por conta de quem usa. */
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(classeDoCampo, "resize-y p-3.5 leading-6", className)} {...props} />
  );
}
