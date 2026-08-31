"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Copy, Trash2, RotateCcw, Pencil } from "lucide-react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { notificar } from "@/lib/ui";
import {
  duplicarProducto,
  eliminarProducto,
  restaurarProducto,
} from "@/app/panel/[catalogo]/productos/actions";

export function ProductRowActions({
  slug,
  producto,
}: {
  slug: string;
  producto: { id: string; name: string; isDeleted: boolean };
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [confirmar, setConfirmar] = useState<"baja" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const correr = async (fn: () => Promise<{ ok: boolean; message: string; data?: unknown }>) => {
    setAbierto(false);
    const r = await fn();
    notificar(r);
    if (r.ok) router.refresh();
    return r;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="rounded-comp-sm p-1.5 text-texto-sec hover:bg-superficie-sec"
        aria-label="Acciones"
      >
        <MoreVertical size={16} />
      </button>

      {abierto && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-comp-sm border border-linea bg-superficie py-1 shadow-[var(--sombra-pop)]">
          <Link
            href={`/panel/${slug}/productos/${producto.id}`}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-texto hover:bg-superficie-sec"
          >
            <Pencil size={14} /> Editar
          </Link>
          {producto.isDeleted ? (
            <button
              onClick={() => correr(() => restaurarProducto(slug, producto.id))}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-texto hover:bg-superficie-sec"
            >
              <RotateCcw size={14} /> Reactivar
            </button>
          ) : (
            <>
              <button
                onClick={() =>
                  correr(() => duplicarProducto(slug, producto.id)).then((r) => {
                    const id = (r.data as { id?: string } | undefined)?.id;
                    if (r.ok && id) router.push(`/panel/${slug}/productos/${id}`);
                  })
                }
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-texto hover:bg-superficie-sec"
              >
                <Copy size={14} /> Duplicar
              </button>
              <button
                onClick={() => {
                  setAbierto(false);
                  setConfirmar("baja");
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-error hover:bg-error-suave"
              >
                <Trash2 size={14} /> Dar de baja
              </button>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        abierto={confirmar === "baja"}
        onCerrar={() => setConfirmar(null)}
        titulo="Dar de baja el producto"
        mensaje={
          <>
            ¿Dar de baja <strong>{producto.name}</strong>? Se oculta del catálogo
            pero queda en el historial y podés reactivarlo.
          </>
        }
        textoConfirmar="Dar de baja"
        peligro
        onConfirmar={async () => {
          await correr(() => eliminarProducto(slug, producto.id));
        }}
      />
    </div>
  );
}
