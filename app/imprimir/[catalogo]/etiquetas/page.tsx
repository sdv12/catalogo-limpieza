import { formatearMoneda, formatearFecha } from "@/lib/format";
import { datosImpresion, type SP } from "../_data";
import { BarraImpresion } from "../BarraImpresion";

export const metadata = { title: "Etiquetas de góndola" };

/** Divide un importe formateado en parte entera y decimales para jerarquía tipográfica. */
function partesPrecio(valor: number) {
  const txt = formatearMoneda(valor); // "$ 1.234,50"
  const m = txt.match(/^(.*?)(,\d+)?$/);
  return { base: m?.[1] ?? txt, dec: m?.[2] ?? "" };
}

export default async function EtiquetasPage({
  params,
  searchParams,
}: {
  params: Promise<{ catalogo: string }>;
  searchParams: Promise<SP>;
}) {
  const { catalogo: slug } = await params;
  const sp = await searchParams;
  const { catalogo, productos, tiers, tier } = await datosImpresion(slug, sp);

  return (
    <>
      <BarraImpresion
        slug={slug}
        titulo={`Etiquetas de góndola · ${productos.length}`}
        tiers={tiers}
        tierActual={tier?.code}
      />

      <div className="mx-auto max-w-[210mm] p-3 sm:p-6 print:p-0">
        <div className="papel p-5 sm:p-8 print:p-0">
          <header className="mb-6 flex items-end justify-between gap-3 border-b border-[#e6e8ec] pb-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-[#111]">
                {catalogo.name}
              </h1>
              <p className="mt-0.5 text-xs text-[#8a929c]">
                Etiquetas de góndola · {formatearFecha(new Date())} ·{" "}
                {productos.length} {productos.length === 1 ? "producto" : "productos"}
              </p>
            </div>
            {tier && (
              <span className="rounded-full bg-[#f0fdfa] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#0f766e]">
                {tier.name}
              </span>
            )}
          </header>

          {productos.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#8a929c]">
              No hay productos para los filtros elegidos.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3 print:gap-2.5">
              {productos.map((p) => {
                const rango =
                  p.precioMin != null &&
                  p.precioMax != null &&
                  p.precioMin !== p.precioMax;
                const pp =
                  p.precioMin != null ? partesPrecio(p.precioMin) : null;
                return (
                  <div
                    key={p.id}
                    className="evitar-corte flex min-h-[46mm] flex-col overflow-hidden rounded-xl border border-[#e0e2e7]"
                  >
                    <div className="flex flex-1 flex-col p-3">
                      {p.categoria && (
                        <span className="mb-1 inline-flex w-fit rounded bg-[#f4f5f7] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">
                          {p.categoria}
                        </span>
                      )}
                      <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-[#111]">
                        {p.nombre}
                      </p>
                      {p.marca && (
                        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[#9aa0a8]">
                          {p.marca}
                        </p>
                      )}
                    </div>

                    <div className="bg-[#f0fdfa] px-3 py-2.5">
                      {pp ? (
                        <p className="flex flex-wrap items-baseline gap-x-0.5 leading-none text-[#134e4a]">
                          {rango && (
                            <span className="mr-0.5 w-full text-[9px] font-semibold uppercase tracking-wide text-[#5f8c85]">
                              desde
                            </span>
                          )}
                          <span className="text-[22px] font-extrabold tracking-tight tabular-nums sm:text-[26px] print:text-[26px]">
                            {pp.base}
                          </span>
                          {pp.dec && (
                            <span className="text-[12px] font-bold tabular-nums sm:text-[13px] print:text-[13px]">
                              {pp.dec}
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-xs text-[#8a929c]">Sin precio cargado</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-[#e6e8ec] px-3 py-1 text-[8px] uppercase tracking-wider text-[#9aa0a8]">
                      <span className="font-mono">{p.sku ?? ""}</span>
                      <span>
                        {p.presentaciones.length > 1
                          ? `${p.presentaciones.length} pres.`
                          : (p.presentaciones[0]?.medida ?? "")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
