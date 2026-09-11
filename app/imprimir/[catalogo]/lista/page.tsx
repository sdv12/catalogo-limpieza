import { datosImpresion, type SP } from "../_data";
import { BarraImpresion } from "../BarraImpresion";
import { ListaImprimible } from "./ListaImprimible";

export const metadata = { title: "Lista de productos" };

export default async function ListaPage({
  params,
  searchParams,
}: {
  params: Promise<{ catalogo: string }>;
  searchParams: Promise<SP>;
}) {
  const { catalogo: slug } = await params;
  const sp = await searchParams;
  const { catalogo, productos } = await datosImpresion(slug, sp);

  return (
    <>
      <BarraImpresion
        slug={slug}
        titulo={`Lista de pedido · ${productos.length}`}
      />

      <div className="mx-auto max-w-[210mm] p-3 sm:p-6 print:p-0">
        <div className="papel p-5 sm:p-8 print:p-0">
          <header className="mb-5 border-b border-[#e6e8ec] pb-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-[#111]">
                  {catalogo.name}
                </h1>
                <p className="mt-0.5 text-xs text-[#8a929c]">
                  Lista de pedido / conteo · {productos.length}{" "}
                  {productos.length === 1 ? "ítem" : "ítems"}
                </p>
              </div>
              <div className="flex gap-6 text-[11px] text-[#5c6570]">
                <span className="flex items-end gap-1.5">
                  Pedido de
                  <span className="inline-block w-32 border-b border-dotted border-[#b8bdc5]" />
                </span>
                <span className="flex items-end gap-1.5">
                  Fecha
                  <span className="inline-block w-24 border-b border-dotted border-[#b8bdc5]" />
                </span>
              </div>
            </div>
          </header>

          {productos.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#8a929c]">
              No hay productos para los filtros elegidos.
            </p>
          ) : (
            <ListaImprimible productos={productos} />
          )}
        </div>
      </div>
    </>
  );
}
