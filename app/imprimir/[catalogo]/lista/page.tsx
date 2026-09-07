import { formatearFecha } from "@/lib/format";
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
        titulo={`Lista de productos · ${productos.length}`}
      />

      <div className="mx-auto max-w-[210mm] px-4 py-6">
        <header className="mb-4 flex items-end justify-between border-b border-[#e2e5e9] pb-3">
          <div>
            <h1 className="text-lg font-semibold text-[#1a1d21]">
              {catalogo.name}
            </h1>
            <p className="text-xs text-[#8a929c]">
              Pedido / conteo de productos · {formatearFecha(new Date())}
            </p>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5c6570]">
            {productos.length} ítems
          </span>
        </header>

        {productos.length === 0 ? (
          <p className="py-16 text-center text-sm text-[#8a929c]">
            No hay productos para los filtros elegidos.
          </p>
        ) : (
          <ListaImprimible productos={productos} />
        )}
      </div>
    </>
  );
}
