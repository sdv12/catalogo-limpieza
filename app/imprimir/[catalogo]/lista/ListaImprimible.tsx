"use client";

import { useState } from "react";
import type { ProductoImpr } from "../_data";

export function ListaImprimible({ productos }: { productos: ProductoImpr[] }) {
  const [cant, setCant] = useState<Record<string, string>>({});
  const [masivo, setMasivo] = useState("");

  const ponerEnTodos = () => {
    const v = masivo.trim();
    if (!v) return;
    setCant(Object.fromEntries(productos.map((p) => [p.id, v])));
  };
  const limpiar = () => setCant({});

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[#e2e5e9] bg-[#f6f7f9] p-3 text-sm">
        <span className="text-[#5c6570]">Cargá las cantidades y después imprimí.</span>
        <span className="ml-auto flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={masivo}
            onChange={(e) => setMasivo(e.target.value)}
            placeholder="Cantidad"
            className="w-24 rounded-md border border-[#cdd2d8] px-2 py-1"
          />
          <button
            type="button"
            onClick={ponerEnTodos}
            className="rounded-md border border-[#cdd2d8] bg-white px-2.5 py-1 hover:bg-[#f1f3f5]"
          >
            Poner en todos
          </button>
          <button
            type="button"
            onClick={limpiar}
            className="rounded-md border border-[#cdd2d8] bg-white px-2.5 py-1 hover:bg-[#f1f3f5]"
          >
            Limpiar
          </button>
        </span>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-[#cdd2d8] text-left text-[11px] uppercase tracking-wider text-[#5c6570]">
            <th className="py-2 pr-2">Código</th>
            <th className="py-2 pr-2">Producto</th>
            <th className="py-2 pr-2">Marca</th>
            <th className="w-24 py-2 pr-2 text-right">Cantidad</th>
            <th className="w-40 py-2">Observaciones</th>
          </tr>
        </thead>
        <tbody>
          {productos.map((p) => (
            <tr key={p.id} className="evitar-corte border-b border-[#e2e5e9]">
              <td className="py-1.5 pr-2 align-top text-[11px] text-[#8a929c] tabular-nums">
                {p.sku ?? "—"}
              </td>
              <td className="py-1.5 pr-2 align-top font-medium text-[#1a1d21]">
                {p.nombre}
                {p.presentaciones.length > 1 && (
                  <span className="ml-1 text-[11px] font-normal text-[#8a929c]">
                    ({p.presentaciones.length} pres.)
                  </span>
                )}
              </td>
              <td className="py-1.5 pr-2 align-top text-[#5c6570]">
                {p.marca ?? "—"}
              </td>
              <td className="py-1.5 pr-2 text-right align-top">
                <input
                  type="number"
                  min={0}
                  value={cant[p.id] ?? ""}
                  onChange={(e) =>
                    setCant((s) => ({ ...s, [p.id]: e.target.value }))
                  }
                  className="w-20 rounded-md border border-[#cdd2d8] px-2 py-1 text-right tabular-nums print:border-0 print:py-0"
                />
              </td>
              <td className="py-1.5 align-top">
                <span className="block h-6 border-b border-dashed border-[#cdd2d8]" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
