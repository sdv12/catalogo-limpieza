import { formatearMoneda, formatearFecha } from "@/lib/format";
import { datosImpresion, type SP } from "../_data";
import { BarraImpresion } from "../BarraImpresion";

export const metadata = { title: "Etiquetas de góndola" };

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

      <div className="mx-auto max-w-[210mm] px-4 py-6">
        <header className="mb-5 flex items-end justify-between border-b border-[#e2e5e9] pb-3">
          <div>
            <h1 className="text-lg font-semibold text-[#1a1d21]">
              {catalogo.name}
            </h1>
            <p className="text-xs text-[#8a929c]">
              Etiquetas de góndola · {formatearFecha(new Date())}
            </p>
          </div>
          {tier && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5c6570]">
              Precio {tier.name}
            </span>
          )}
        </header>

        {productos.length === 0 ? (
          <p className="py-16 text-center text-sm text-[#8a929c]">
            No hay productos para los filtros elegidos.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {productos.map((p) => {
              const rango =
                p.precioMin != null &&
                p.precioMax != null &&
                p.precioMin !== p.precioMax;
              return (
                <div
                  key={p.id}
                  className="evitar-corte flex min-h-[50mm] flex-col rounded-lg border border-[#e2e5e9] border-t-[3px] border-t-[#0d9488] p-3"
                >
                  {p.categoria && (
                    <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#8a929c]">
                      {p.categoria}
                    </span>
                  )}
                  <p className="mt-0.5 line-clamp-3 text-[13px] font-semibold uppercase leading-tight text-[#1a1d21]">
                    {p.nombre}
                  </p>
                  {p.marca && (
                    <p className="mt-0.5 text-[11px] text-[#5c6570]">{p.marca}</p>
                  )}

                  <div className="mt-auto pt-2">
                    {p.precioMin != null ? (
                      <p className="text-[26px] font-bold leading-none tracking-tight text-[#0f766e] tabular-nums">
                        {rango && (
                          <span className="text-[11px] font-medium text-[#8a929c]">
                            desde{" "}
                          </span>
                        )}
                        {formatearMoneda(p.precioMin)}
                      </p>
                    ) : (
                      <p className="text-sm text-[#8a929c]">Sin precio cargado</p>
                    )}
                    <div className="mt-1.5 flex items-center justify-between border-t border-[#e2e5e9] pt-1 text-[8px] uppercase tracking-wider text-[#8a929c]">
                      <span>{tier?.name ?? "—"}</span>
                      <span>
                        {p.presentaciones.length > 1
                          ? `${p.presentaciones.length} pres.`
                          : (p.presentaciones[0]?.medida ?? p.sku ?? "")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
