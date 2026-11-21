import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ---- Buttons ------------------------------------------------------------------

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover shadow-card",
  secondary: "bg-surface text-ink border border-line hover:border-ink/30 hover:bg-surface-2",
  ghost: "text-ink hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90",
  soft: "bg-accent-soft text-accent hover:brightness-95",
};
const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-[15px] gap-2",
  lg: "h-13 px-7 text-base gap-2.5",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap select-none",
    "transition-[background-color,border-color,transform,box-shadow,opacity] duration-200 active:scale-[0.97]",
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

// ---- Surfaces -------------------------------------------------------------------

export function Card({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("rounded-3xl border border-line bg-surface shadow-card", className)} {...rest} />;
}

export function Badge({ tone = "neutral", className, ...rest }: ComponentProps<"span"> & { tone?: "neutral" | "accent" | "success" | "danger" }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    accent: "bg-accent-soft text-accent",
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)} {...rest} />;
}

export function Alert({ tone = "info", children, className }: { tone?: "info" | "success" | "error"; children: ReactNode; className?: string }) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? AlertCircle : Info;
  const tones = {
    info: "bg-surface-2 text-ink",
    success: "bg-success-soft text-success",
    error: "bg-danger-soft text-danger",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm", tones[tone], className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      {icon && <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">{icon}</div>}
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {children && <div className="mt-2 max-w-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ---- Form fields ----------------------------------------------------------------

export function Label({ className, ...rest }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-sm font-semibold", className)} {...rest} />;
}

const fieldBase =
  "w-full rounded-2xl border border-line bg-surface px-4 text-[15px] text-ink placeholder:text-muted/70 transition-colors focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 aria-[invalid=true]:border-danger";

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-12", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "py-3 leading-relaxed", className)} {...rest} />;
}

export function Select({ className, ...rest }: ComponentProps<"select">) {
  return <select className={cn(fieldBase, "h-12 appearance-none bg-[length:16px] pr-10", className)} {...rest} />;
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-danger">
      {children}
    </p>
  );
}

export function Hint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mt-1.5 text-sm text-muted", className)}>{children}</p>;
}

/** Accessible on/off switch (role="switch"). */
export function Switch({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: ReactNode;
  id: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200",
          checked ? "bg-accent" : "bg-line",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-white shadow transition-transform duration-200",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-muted", className)} aria-label="Loading" />;
}
