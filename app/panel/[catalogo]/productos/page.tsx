import Link from "next/link";
import { Plus } from "lucide-react";
import { resolverCatalogo, puedeEditar, tienePermiso } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import {
  tiersDelCatalogo,
  marcasDelCatalogo,
  proveedoresDelCatalogo,
} from "@/lib/catalog-data";
import { PRODUCTOS_POR_PAGINA } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { ProductsFilters } from "@/components/products/ProductsFilters";
import { ProductsTable } from "@/components/products/ProductsTable";
import { ReprecioContextual } from "@/components/products/ReprecioContextual";
import { BotonImprimir } from "@/components/products/BotonImprimir";

export const metadata = { title: "Productos — Catálogo" };

type SP = Record<string, string | undefined>;

const SORTS = ["name", "status", "created_at", "updated_at"] as const;

export default async function ProductosPage({
  params,
  searchParams,
}: {
  params: Promise<{ catalogo: string }>;
  searchParams: Promise<SP>;
}) {
  const { catalogo: slug } = await params;
  const sp = await searchParams;
  const catalogo = await resolverCatalogo(slug);
  const supabase = await createClient();

  const pagina = Math.max(1, Number(sp.page) || 1);
  const sort = (SORTS as readonly string[]).includes(sp.sort ?? "")
    ? sp.sort!
    : "updated_at";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const verBorrados = sp.borrados === "1";
  const estado: "active" | "inactive" | undefined =
    sp.estado === "active" || sp.estado === "inactive" ? sp.estado : undefined;
  const stock: "low" | "ok" | undefined =
    sp.stock === "low" || sp.stock === "ok" ? sp.stock : undefined;
  const verCostos = tienePermiso(catalogo, "costos");
  const puedeRepreciar = tienePermiso(catalogo, "precios_lote");

  // Marca y proveedor son datos de gestión: solo quien ve costos filtra por ellos.
  const marcaFiltro = verCostos ? sp.marca || undefined : undefined;
  const proveedorFiltro = verCostos ? sp.proveedor || undefined : undefined;

  const [{ data: filas, error }, { data: categorias }, marcas, proveedores, tiers] =
    await Promise.all([
      supabase.rpc("search_products", {
        p_catalog_id: catalogo.id,
        p_q: sp.q?.trim() || undefined,
        p_category_id: sp.categoria || undefined,
        p_brand: marcaFiltro,
        p_supplier_id: proveedorFiltro,
        p_status: estado,
        p_stock: stock,
        p_include_deleted: verBorrados,
        p_sort: sort,
        p_dir: dir,
        p_limit: PRODUCTOS_POR_PAGINA,
        p_offset: (pagina - 1) * PRODUCTOS_POR_PAGINA,
      }),
      supabase
        .from("categories")
        .select("id, name, parent_id")
        .eq("catalog_id", catalogo.id)
        .order("sort_order"),
      verCostos ? marcasDelCatalogo(supabase, catalogo.id) : Promise.resolve([]),
      verCostos ? proveedoresDelCatalogo(supabase, catalogo.id) : Promise.resolve([]),
      puedeRepreciar ? tiersDelCatalogo(supabase, catalogo.id) : Promise.resolve([]),
    ]);

  const total = filas?.[0]?.total_count ?? 0;
  const soloLectura = !puedeEditar(catalogo);

  const filtro = {
    q: sp.q?.trim() || undefined,
    categoria: sp.categoria || undefined,
    marca: marcaFiltro,
    proveedor: proveedorFiltro,
    estado,
    stock,
  };
  const hayFiltro = Object.values(filtro).some(Boolean);

  const hacerHref = (cambios: SP) => {
    const q = new URLSearchParams();
    const merged: SP = { ...sp, ...cambios };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "") q.set(k, v);
    }
    const s = q.toString();
    return `/panel/${slug}/productos${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-texto">Productos</h1>
          <p className="mt-1 text-sm text-texto-sec">
            {total} {total === 1 ? "producto" : "productos"}
            {verBorrados ? " (incluye dados de baja)" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BotonImprimir slug={slug} />
          {!soloLectura && (
            <Link href={`/panel/${slug}/productos/nuevo`}>
              <Button>
                <Plus size={16} />
                Nuevo producto
              </Button>
            </Link>
          )}
        </div>
      </div>

      <ProductsFilters
        categorias={categorias ?? []}
        marcas={marcas}
        proveedores={proveedores}
        verCostos={verCostos}
      />

      {puedeRepreciar && !verBorrados && total > 0 && (
        <ReprecioContextual
          slug={slug}
          tiers={tiers}
          filtro={filtro}
          total={total}
          hayFiltro={hayFiltro}
        />
      )}

      {error ? (
        <p className="text-sm text-error">No se pudo cargar el listado: {error.message}</p>
      ) : (filas?.length ?? 0) === 0 ? (
        <EmptyState
          titulo="Sin resultados"
          descripcion="Probá cambiar la búsqueda o los filtros, o cargá un producto nuevo."
        />
      ) : (
        <>
          <ProductsTable
            slug={slug}
            filas={filas ?? []}
            soloLectura={soloLectura}
            verCostos={verCostos}
            orden={{ sort, dir }}
            hacerHref={hacerHref}
          />
          <Pagination
            total={total}
            porPagina={PRODUCTOS_POR_PAGINA}
            paginaActual={pagina}
            hacerHref={(p) => hacerHref({ page: String(p) })}
          />
        </>
      )}
    </div>
  );
}
