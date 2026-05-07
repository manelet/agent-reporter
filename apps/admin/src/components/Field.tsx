import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-400">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1 block text-xs text-zinc-500">{hint}</span>
      ) : null}
      {error ? (
        <span className="mt-1 block text-xs text-red-400">{error}</span>
      ) : null}
    </label>
  );
}

const inputClass =
  "w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm outline-none focus:border-zinc-500";

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea {...props} className={`${inputClass} ${props.className ?? ""}`} />
  );
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  return (
    <select {...props} className={`${inputClass} ${props.className ?? ""}`} />
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
}

export function Button({
  variant = "secondary",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const styles: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary:
      "bg-zinc-100 text-zinc-900 hover:bg-white disabled:opacity-50",
    secondary:
      "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:opacity-50",
    danger: "bg-red-900/60 text-red-200 hover:bg-red-900",
  };
  return (
    <button
      {...rest}
      className={`rounded px-3 py-1.5 text-sm font-medium transition ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
