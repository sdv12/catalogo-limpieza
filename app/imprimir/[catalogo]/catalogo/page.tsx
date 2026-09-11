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

      <div className="mx-auto max-w-[210mm] p-3 sm:p-6 print:p-0">
        <div className="papel overflow-hidden print:overflow-visible">
          {/* Portada */}
          <section className="salto flex flex-col items-center bg-[#f0fdfa] px-8 py-12 text-center">
            {catalogo.logo_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imagenUrl(catalogo.logo_path)}
                alt={catalogo.name}
                className="mb-5 h-20 w-auto object-contain"
              />
            ) : (
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0d9488] text-2xl font-bold text-white">
                {catalogo.name.charAt(0)}
              </div>
            )}
            <h1 className="text-[26px] font-semibold tracking-tight text-[#0f2f2b]">
              {catalogo.name}
            </h1>
            <p className="mt-1 text-sm text-[#3f6b64]">
              Catálogo para revendedores
            </p>
            <div className="mt-5 h-px w-16 bg-[#0d9488]/30" />
            <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-[#5f8c85]">
              {tier ? `Lista ${tier.name}` : "Sin lista de precios"} ·{" "}
              {formatearFecha(new Date())} · {productos.length} productos
            </p>
          </section>

          <div className="p-5 sm:p-8 print:p-6">
            {productos.length === 0 ? (
              <p className="py-16 text-center text-sm text-[#8a929c]">
                No hay productos para los filtros elegidos.
              </p>
            ) : (
              <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 print:grid-cols-2 print:gap-4">
                {productos.map((p) => (
                  <article
                    key={p.id}
                    className="evitar-corte flex flex-col overflow-hidden rounded-2xl border border-[#e0e2e7]"
                  >
                    {p.imagen && (
                      <div className="flex aspect-[5/3] items-center justify-center border-b border-[#eceef1] bg-[#fafafa] p-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imagenUrl(p.imagen)}
                          alt={p.nombre}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-4">
                      {p.categoria && (
                        <span className="mb-1 inline-flex w-fit rounded bg-[#f0fdfa] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-[#0f766e]">
                          {p.categoria}
                        </span>
                      )}
                      <h2 className="text-[15px] font-semibold leading-snug text-[#111]">
                        {p.nombre}
                      </h2>
                      {p.marca && (
                        <p className="text-[11px] uppercase tracking-wide text-[#9aa0a8]">
                          {p.marca}
                        </p>
                      )}

                      <div className="mt-3 divide-y divide-[#eceef1] border-t border-[#e6e8ec]">
                        {p.presentaciones.length === 0 ? (
                          <p className="py-2 text-[11px] text-[#9aa0a8]">
                            Sin presentaciones cargadas
                          </p>
                        ) : (
                          p.presentaciones.map((v, i) => (
                            <div
                              key={i}
                              className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-2 text-[11px]"
                            >
                              <span className="text-[#5c6570]">
                                {v.medida ?? v.nombre ?? "Unidad"}
                              </span>
                              <span className="font-bold tabular-nums text-[#0f766e]">
                                {v.precio != null ? formatearMoneda(v.precio) : "—"}
                              </span>
                              <span className="col-span-2 flex items-end gap-1.5 text-[10px] text-[#9aa0a8]">
                                Mi precio
                                <span className="flex-1 translate-y-[-2px] border-b border-dotted border-[#b8bdc5]" />
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <p className="mt-8 border-t border-[#e6e8ec] pt-4 text-center text-[10px] text-[#9aa0a8]">
              {catalogo.name} · Precios sujetos a modificación sin previo aviso ·{" "}
              {formatearFecha(new Date())}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
