"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function Modal({
  abierto,
  onCerrar,
  titulo,
  children,
  ancho = "md",
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: React.ReactNode;
  ancho?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6">
      <div
        className="absolute inset-0"
        onClick={onCerrar}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cn(
          "relative z-10 my-8 w-full rounded-comp bg-superficie shadow-[var(--sombra-pop)]",
          ancho === "sm" && "max-w-sm",
          ancho === "md" && "max-w-lg",
          ancho === "lg" && "max-w-3xl",
        )}
      >
        <div className="flex items-center justify-between border-b border-linea px-5 py-3">
          <h2 className="text-sm font-semibold text-texto">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-comp-sm p-1 text-texto-sec hover:bg-superficie-sec"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
