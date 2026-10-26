import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "clay" | "soft" | "ghost" | "line";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:brightness-110",
  clay: "bg-clay text-on-clay hover:brightness-110",
  soft: "bg-primary-soft text-primary hover:brightness-95",
  ghost: "bg-transparent text-ink hover:bg-paper",
  line: "border border-line bg-surface text-ink hover:bg-paper",
};

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-[filter,background-color] duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const control =
  "h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink outline-none placeholder:text-muted focus-visible:border-primary";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(control, props.className)} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(control, props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(control, "h-24 py-2", props.className)} />;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-card bg-surface p-4 shadow-card", className)}>{children}</section>;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-2xl bg-paper p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-11 flex-1 rounded-xl px-2 text-sm font-medium",
              active ? "bg-surface text-ink shadow-card" : "text-muted",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
