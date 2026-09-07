import { formatearMoneda, formatearFecha } from "@/lib/format";
import { imagenUrl } from "@/lib/storage";
import { datosImpresion, type SP } from "../_data";
import { BarraImpresion } from "../BarraImpresion";

export const metadata = { title: "Catálogo para revendedores" };

export default async function CatalogoPage({
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
        titulo={`Catálogo para revendedores · ${productos.length}`}
        tiers={tiers}
        tierActual={tier?.code}
      />

      <div className="mx-auto max-w-[210mm] px-6 py-8">
        <section className="salto mb-8 flex flex-col items-center border-b border-[#e2e5e9] pb-8 text-center">
          {catalogo.logo_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagenUrl(catalogo.logo_path)}
              alt={catalogo.name}
              className="mb-4 h-20 w-auto object-contain"
            />
          ) : (
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#0d9488] text-2xl font-bold text-white">
              {catalogo.name.charAt(0)}
            </div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-[#1a1d21]">
            {catalogo.name}
          </h1>
          <p className="mt-1 text-sm text-[#5c6570]">Catálogo para revendedores</p>
          <p className="mt-3 text-xs uppercase tracking-wider text-[#8a929c]">
            {tier ? `Precio ${tier.name}` : "Sin lista de precios"} ·{" "}
            {formatearFecha(new Date())} · {productos.length} productos
          </p>
        </section>

        {productos.length === 0 ? (
          <p className="py-16 text-center text-sm text-[#8a929c]">
            No hay productos para los filtros elegidos.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-5">
            {productos.map((p) => (
              <article
                key={p.id}
                className="evitar-corte overflow-hidden rounded-xl border border-[#e2e5e9]"
              >
                <div className="flex h-40 items-center justify-center bg-[#f6f7f9] p-3">
                  {p.imagen ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagenUrl(p.imagen)}
                      alt={p.nombre}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-[#cdd2d8]">Sin imagen</span>
                  )}
                </div>
                <div className="p-3.5">
                  {p.categoria && (
                    <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#8a929c]">
                      {p.categoria}
                    </span>
                  )}
                  <h2 className="mt-0.5 text-sm font-semibold leading-tight text-[#1a1d21]">
                    {p.nombre}
                  </h2>
                  {p.marca && (
                    <p className="text-[11px] text-[#5c6570]">{p.marca}</p>
                  )}

                  <table className="mt-2.5 w-full text-[11px]">
                    <tbody>
                      {p.presentaciones.map((v, i) => (
                        <tr key={i} className="border-t border-[#e2e5e9]">
                          <td className="py-1 pr-2 text-[#5c6570]">
                            {v.medida ?? v.nombre ?? "Unidad"}
                          </td>
                          <td className="py-1 pr-2 text-right font-semibold text-[#0f766e] tabular-nums">
                            {v.precio != null ? formatearMoneda(v.precio) : "—"}
                          </td>
                          <td className="w-[38%] py-1 pl-2 text-[#8a929c]">
                            <span className="inline-flex w-full items-end gap-1">
                              Mi precio
                              <span className="flex-1 border-b border-dotted border-[#8a929c]" />
                            </span>
                          </td>
                        </tr>
                      ))}
                      {p.presentaciones.length === 0 && (
                        <tr className="border-t border-[#e2e5e9]">
                          <td colSpan={3} className="py-1 text-[#8a929c]">
                            Sin presentaciones cargadas
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
