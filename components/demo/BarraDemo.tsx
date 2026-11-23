"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { FlaskConical, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

type Usuario = { id: string; nombre: string };

/** Barra del modo demo local: elegir con qué usuario probar y reiniciar los datos. */
export function BarraDemo({ usuarios, actual }: { usuarios: Usuario[]; actual: string }) {
  const pathname = usePathname();
  const [abierta, setAbierta] = useState(true);
  const ir = (params: string) => {
    // navegación completa a propósito: la ruta setea la cookie del usuario demo
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/demo?${params}&volver=${encodeURIComponent(pathname)}`;
  };
  return (
    <div className="fixed bottom-4 left-4 z-[60] w-72 rounded-comp border-2 border-dashed border-alerta bg-alerta-suave/95 text-sm shadow-lg backdrop-blur print:hidden">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 font-semibold text-alerta"
      >
        <FlaskConical size={16} />
        MODO DEMO · datos inventados
        {abierta ? <ChevronDown size={14} className="ml-auto" /> : <ChevronUp size={14} className="ml-auto" />}
      </button>
      {abierta && (
        <div className="space-y-2 border-t border-alerta/30 px-3 pb-3 pt-2">
          <label className="block text-xs text-texto-sec">
            Probar como
            <select
              value={actual}
              onChange={(e) => ir(`usuario=${e.target.value}`)}
              className="mt-1 block h-9 w-full rounded-comp-sm border border-linea-fuerte bg-superficie px-2 text-sm text-texto"
            >
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("¿Volver los datos inventados al estado inicial?")) ir("reiniciar=1");
            }}
            className="inline-flex items-center gap-1 text-xs text-alerta hover:underline"
          >
            <RotateCcw size={12} />
            Reiniciar datos
          </button>
          <p className="text-[11px] leading-snug text-texto-sec">
            Nada de esto toca la base real. Los datos se pierden al reiniciar el servidor.
          </p>
        </div>
      )}
    </div>
  );
}
