import { forwardRef } from "react";
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-comp-sm border border-linea-fuerte bg-superficie px-3 py-2 text-sm text-texto outline-none transition-colors placeholder:text-texto-tenue focus:border-primario disabled:opacity-50 aria-[invalid=true]:border-error";

export function Label({
  className,
  requerido,
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { requerido?: boolean }) {
  return (
    <label
      className={cn(
        "mb-1 block text-xs font-semibold uppercase tracking-wide text-texto-sec",
        className,
      )}
      {...props}
    >
      {children}
      {requerido && <span className="ml-0.5 text-error">*</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(control, className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea ref={ref} className={cn(control, "min-h-20", className)} {...props} />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(control, "pr-8", className)} {...props}>
      {children}
    </select>
  );
});

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-error">{children}</p>;
}

export function FieldHint({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-texto-tenue">{children}</p>;
}
