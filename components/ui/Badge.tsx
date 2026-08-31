import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tono = "neutro" | "exito" | "alerta" | "error" | "info" | "primario";

const tonos: Record<Tono, string> = {
  neutro: "bg-superficie-sec text-texto-sec",
  exito: "bg-exito-suave text-exito",
  alerta: "bg-alerta-suave text-alerta",
  error: "bg-error-suave text-error",
  info: "bg-info-suave text-info",
  primario: "bg-primario-suave text-primario-fuerte",
};

export function Badge({
  tono = "neutro",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tono?: Tono }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tonos[tono],
        className,
      )}
      {...props}
    />
  );
}
