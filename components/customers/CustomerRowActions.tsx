"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreVertical, Pencil, Trash2, RotateCcw } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { notificar } from "@/lib/ui";
import {
  eliminarCliente,
  restaurarCliente,
} from "@/app/panel/[catalogo]/clientes/actions";

export function CustomerRowActions({
  slug,
  cliente,
}: {
  slug: string;
  cliente: { id: string; name: string; isDeleted: boolean };
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const correr = async (fn: () => Promise<{ ok: boolean; message: string }>) => {
    setAbierto(false);
    const r = await fn();
    notificar(r);
    if (r.ok) router.refresh();
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
        <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-comp-sm border border-linea bg-superficie py-1 shadow-[var(--sombra-pop)]">
          <Link
            href={`/panel/${slug}/clientes/${cliente.id}`}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-texto hover:bg-superficie-sec"
          >
            <Pencil size={14} /> Editar
          </Link>
          {cliente.isDeleted ? (
            <button
              onClick={() => correr(() => restaurarCliente(slug, cliente.id))}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-texto hover:bg-superficie-sec"
            >
              <RotateCcw size={14} /> Restaurar
            </button>
          ) : (
            <button
              onClick={() => {
                setAbierto(false);
                setConfirmar(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-error hover:bg-error-suave"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        abierto={confirmar}
        onCerrar={() => setConfirmar(false)}
        titulo="Eliminar cliente"
        mensaje={
          <>
            ¿Eliminar a <strong>{cliente.name}</strong>? Se oculta del listado
            pero queda en el historial y podés restaurarlo.
          </>
        }
        textoConfirmar="Eliminar"
        peligro
        onConfirmar={async () => {
          await correr(() => eliminarCliente(slug, cliente.id));
        }}
      />
    </div>
  );
}
