"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { BuscadorUrl, SelectUrl, CheckboxUrl } from "@/components/common/FiltrosUrl";

type Categoria = { id: string; name: string; parent_id: string | null };
type Proveedor = { id: string; name: string };

const CLAVES = ["categoria", "marca", "proveedor", "estado", "stock", "borrados"];

export function ProductsFilters({
  categorias,
  marcas,
  proveedores,
  verCostos,
}: {
  categorias: Categoria[];
  marcas: string[];
  proveedores: Proveedor[];
  verCostos: boolean;
}) {
  const searchParams = useSearchParams();
  const activos = CLAVES.filter((k) => searchParams.get(k)).length;
  const [abierto, setAbierto] = useState(false);

  const opcionesCategoria = (() => {
    const hijos = new Map<string | null, Categoria[]>();
    for (const c of categorias) {
      const lista = hijos.get(c.parent_id) ?? [];
      lista.push(c);
      hijos.set(c.parent_id, lista);
    }
    const out: { id: string; label: string }[] = [];
    const rec = (parent: string | null, pref: string) => {
      for (const c of hijos.get(parent) ?? []) {
        out.push({ id: c.id, label: pref + c.name });
        rec(c.id, pref + "— ");
      }
    };
    rec(null, "");
    return out;
  })();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 sm:max-w-lg">
        <BuscadorUrl
          placeholder={
            verCostos
              ? "Buscar por nombre, SKU, marca o proveedor…"
              : "Buscar por nombre o SKU…"
          }
        />
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-comp-sm border border-linea-fuerte bg-superficie px-3 text-sm text-texto hover:bg-superficie-sec sm:hidden"
          aria-expanded={abierto}
        >
          <SlidersHorizontal size={15} />
          Filtros
          {activos > 0 && (
            <span className="rounded-full bg-primario px-1.5 text-[11px] font-semibold text-white">
              {activos}
            </span>
          )}
        </button>
      </div>

      <div
        className={`${abierto ? "grid" : "hidden"} grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-end`}
      >
        <SelectUrl param="categoria" ariaLabel="Filtrar por categoría" className="sm:w-48">
          <option value="">Todas las categorías</option>
          {opcionesCategoria.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </SelectUrl>

        {verCostos && marcas.length > 0 && (
          <SelectUrl param="marca" ariaLabel="Filtrar por marca" className="sm:w-44">
            <option value="">Todas las marcas</option>
            {marcas.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </SelectUrl>
        )}

        {verCostos && proveedores.length > 0 && (
          <SelectUrl param="proveedor" ariaLabel="Filtrar por proveedor" className="sm:w-48">
            <option value="">Todos los proveedores</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectUrl>
        )}

        <SelectUrl param="estado" ariaLabel="Filtrar por estado" className="sm:w-40">
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </SelectUrl>

        <SelectUrl param="stock" ariaLabel="Filtrar por stock" className="sm:w-40">
          <option value="">Todo el stock</option>
          <option value="low">Stock bajo</option>
          <option value="ok">Stock ok</option>
        </SelectUrl>

        <CheckboxUrl param="borrados" label="Ver dados de baja" />
      </div>
    </div>
  );
}
