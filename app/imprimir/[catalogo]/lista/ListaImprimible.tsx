"use client";

import { useMemo, useState } from "react";
import type { ProductoImpr } from "../_data";

export function ListaImprimible({ productos }: { productos: ProductoImpr[] }) {
  const [cant, setCant] = useState<Record<string, string>>({});
  const [masivo, setMasivo] = useState("");
  const [soloConCantidad, setSoloConCantidad] = useState(false);

  const ponerEnTodos = () => {
    const v = masivo.trim();
    if (!v) return;
    setCant(Object.fromEntries(productos.map((p) => [p.id, v])));
  };

  const visibles = useMemo(
    () =>
      soloConCantidad
        ? productos.filter((p) => Number(cant[p.id]) > 0)
        : productos,
    [productos, cant, soloConCantidad],
  );

  const totalUnidades = Object.values(cant).reduce(
    (a, v) => a + (Number(v) || 0),
    0,
  );

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#e6e8ec] bg-[#f7f8fa] p-3 text-sm">
        <span className="text-[#5c6570]">
          Cargá las cantidades y después imprimí o guardá el PDF.
        </span>
        <label className="ml-2 flex items-center gap-1.5 text-xs text-[#5c6570]">
          <input
            type="checkbox"
            checked={soloConCantidad}
            onChange={(e) => setSoloConCantidad(e.target.checked)}
          />
          Imprimir solo con cantidad
        </label>
        <span className="ml-auto flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={masivo}
            onChange={(e) => setMasivo(e.target.value)}
            placeholder="Cant."
            className="w-20 rounded-md border border-[#cdd2d8] px-2 py-1"
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
            onClick={() => setCant({})}
            className="rounded-md border border-[#cdd2d8] bg-white px-2.5 py-1 hover:bg-[#f1f3f5]"
          >
            Limpiar
          </button>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-[#cdd2d8] bg-[#f7f8fa] text-left text-[10px] uppercase tracking-wider text-[#5c6570] print:bg-transparent">
              <th className="px-2 py-2 font-semibold">Código</th>
              <th className="px-2 py-2 font-semibold">Producto</th>
              <th className="px-2 py-2 font-semibold">Marca</th>
              <th className="w-20 px-2 py-2 text-right font-semibold">Cant.</th>
              <th className="w-44 px-2 py-2 font-semibold">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => (
              <tr
                key={p.id}
                className="evitar-corte border-b border-[#eceef1] even:bg-[#fafbfc] print:even:bg-[#f6f7f8]"
              >
                <td className="px-2 py-1.5 align-top font-mono text-[10px] text-[#9aa0a8]">
                  {p.sku ?? "—"}
                </td>
                <td className="px-2 py-1.5 align-top font-medium text-[#1a1d21]">
                  {p.nombre}
                  {p.presentaciones.length > 1 && (
                    <span className="ml-1 text-[10px] font-normal text-[#9aa0a8]">
                      ({p.presentaciones.length} pres.)
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 align-top text-[#5c6570]">
                  {p.marca ?? "—"}
                </td>
                <td className="px-2 py-1 text-right align-top">
                  <input
                    type="number"
                    min={0}
                    value={cant[p.id] ?? ""}
                    onChange={(e) =>
                      setCant((s) => ({ ...s, [p.id]: e.target.value }))
                    }
                    className="w-16 rounded-md border border-[#cdd2d8] px-2 py-1 text-right tabular-nums outline-none focus:border-[#0d9488] print:rounded-none"
                  />
                </td>
                <td className="px-2 py-1.5 align-bottom">
                  <span className="block h-5 border-b border-dotted border-[#c4c8cf]" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#cdd2d8] text-[11px] font-semibold text-[#1a1d21]">
              <td colSpan={3} className="px-2 py-2 text-right uppercase tracking-wide">
                Total
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {totalUnidades || ""}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
