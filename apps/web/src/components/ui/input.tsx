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

  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor={inputId}>
      <span>
        {label}
        {props.required && (
          <span aria-hidden="true" className="ml-1 text-emerald-700">
            *
          </span>
        )}
      </span>
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error || helperText ? `${inputId}-hint` : undefined}
        className={cn(
          "h-12 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10",
          error && "border-red-500 focus:border-red-600 focus:ring-red-100",
          className
        )}
        {...props}
      />
      {error ? (
        <span id={`${inputId}-hint`} className="text-xs font-normal text-red-700">
          {error}
        </span>
      ) : helperText ? (
        <span id={`${inputId}-hint`} className="text-xs font-normal text-slate-500">
          {helperText}
        </span>
      ) : null}
    </label>
  );
}
