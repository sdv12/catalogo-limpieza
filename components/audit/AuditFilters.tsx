"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Select, Input } from "@/components/ui/Field";
import { ACCIONES_AUDITORIA, ETIQUETA_ACCION } from "@/lib/constants";

type Actor = { actor_id: string; actor_email: string | null };
type ProductoOpt = { id: string; name: string };

export function AuditFilters({
  actores,
  productos,
  valores,
}: {
  actores: Actor[];
  productos: ProductoOpt[];
  valores: {
    actor: string;
    accion: string;
    producto: string;
    desde: string;
    hasta: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendiente, startTransition] = useTransition();

  const set = (cambios: Record<string, string>) => {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    p.delete("page");
    startTransition(() => router.replace(`${pathname}?${p.toString()}`));
  };

  const hayFiltros =
    valores.actor || valores.accion || valores.producto || valores.desde || valores.hasta;

  const nombreProducto = productos.find((p) => p.id === valores.producto)?.name;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <Select
          value={valores.accion}
          onChange={(e) => set({ accion: e.target.value })}
          aria-label="Tipo de acción"
          className="w-48"
        >
          <option value="">Todas las acciones</option>
          {ACCIONES_AUDITORIA.map((a) => (
            <option key={a} value={a}>
              {ETIQUETA_ACCION[a]}
            </option>
          ))}
        </Select>

        <Select
          value={valores.actor}
          onChange={(e) => set({ actor: e.target.value })}
          aria-label="Usuario"
          className="w-48"
        >
          <option value="">Todos los usuarios</option>
          {actores.map((a) => (
            <option key={a.actor_id} value={a.actor_id}>
              {a.actor_email ?? a.actor_id.slice(0, 8)}
            </option>
          ))}
        </Select>

        <Select
          value={valores.producto}
          onChange={(e) => set({ producto: e.target.value })}
          aria-label="Producto"
          className="w-52"
        >
          <option value="">Todos los productos</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>

        <label className="text-xs text-texto-sec">
          Desde
          <Input
            type="date"
            value={valores.desde}
            onChange={(e) => set({ desde: e.target.value })}
            className="mt-0.5 h-9 w-40"
          />
        </label>
        <label className="text-xs text-texto-sec">
          Hasta
          <Input
            type="date"
            value={valores.hasta}
            onChange={(e) => set({ hasta: e.target.value })}
            className="mt-0.5 h-9 w-40"
          />
        </label>
      </div>

      {hayFiltros && (
        <button
          type="button"
          onClick={() =>
            set({ actor: "", accion: "", producto: "", desde: "", hasta: "" })
          }
          className="inline-flex items-center gap-1 text-xs text-primario hover:underline"
          disabled={pendiente}
        >
          <X size={12} />
          Limpiar filtros
          {valores.producto && nombreProducto ? ` · producto: ${nombreProducto}` : ""}
        </button>
      )}
    </div>
  );
}
