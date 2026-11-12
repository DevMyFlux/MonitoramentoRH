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
  "w-full min-w-0 rounded-lab-md border border-lab-linha-forte bg-lab-superficie text-lab-corpo text-lab-tinta outline-none transition duration-lab-rapida placeholder:text-lab-tinta-3 hover:border-lab-tinta-3/70 focus:border-lab-destaque focus:ring-4 focus:ring-lab-destaque/15 disabled:cursor-not-allowed disabled:bg-lab-superficie-3 disabled:opacity-70";

const classeDoErro =
  "border-lab-perigo hover:border-lab-perigo focus:border-lab-perigo focus:ring-lab-perigo/15";

const classeDoRotulo = "grid gap-2 text-lab-pequeno font-medium text-lab-tinta";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  helperText?: string | undefined;
  error?: string | undefined;
};

export function Input({ className, error, helperText, id, label, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? props.name ?? generatedId;

  return (
    <label className={classeDoRotulo} htmlFor={inputId}>
      <span>
        {label}
        {props.required && (
          <span aria-hidden="true" className="ml-1 text-lab-destaque">
            *
          </span>
        )}
      </span>
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error || helperText ? `${inputId}-hint` : undefined}
        className={cn(classeDoCampo, "h-11 px-3.5", error && classeDoErro, className)}
        {...props}
      />
      {error ? (
        <span id={`${inputId}-hint`} className="text-lab-legenda font-normal text-lab-perigo-texto">
          {error}
        </span>
      ) : helperText ? (
        <span id={`${inputId}-hint`} className="text-lab-legenda font-normal text-lab-tinta-2">
          {helperText}
        </span>
      ) : null}
    </label>
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
  const selectId = id ?? props.name;

  return (
    <label className={classeDoRotulo} htmlFor={selectId}>
      <span>{label}</span>
      <span className="relative block">
        <select
          id={selectId}
          className={cn(
            classeDoCampo,
            "h-11 cursor-pointer appearance-none pl-3.5 pr-10",
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
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-lab-tinta-3"
        />
      </span>
      {error ? (
        <span className="text-lab-legenda font-normal text-lab-perigo-texto">{error}</span>
      ) : null}
    </label>
  );
}

/** Área de texto com a aparência dos demais campos. O rótulo fica por conta de quem usa. */
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(classeDoCampo, "resize-y p-3.5 leading-6", className)} {...props} />
  );
}
