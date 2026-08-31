import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variante = "primario" | "secundario" | "peligro" | "fantasma";
type Tamano = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-comp-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario";

const variantes: Record<Variante, string> = {
  primario: "bg-primario text-white hover:bg-primario-fuerte",
  secundario:
    "border border-linea-fuerte bg-superficie text-texto hover:bg-superficie-sec",
  peligro: "bg-error text-white hover:opacity-90",
  fantasma: "text-texto-sec hover:bg-superficie-sec hover:text-texto",
};

const tamanos: Record<Tamano, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variante = "primario", tamano = "md", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variantes[variante], tamanos[tamano], className)}
      {...props}
    />
  );
});
