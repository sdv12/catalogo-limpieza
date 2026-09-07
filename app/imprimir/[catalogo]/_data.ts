import "server-only";
import { resolverCatalogo } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export type SP = Record<string, string | undefined>;

export type PresentacionImpr = {
  nombre: string | null;
  medida: string | null;
  precio: number | null;
  costo: number | null;
};

export type ProductoImpr = {
  id: string;
  nombre: string;
  marca: string | null;
  sku: string | null;
  categoria: string | null;
  proveedor: string | null;
  imagen: string | null;
  presentaciones: PresentacionImpr[];
  precioMin: number | null;
  precioMax: number | null;
};

export type Tier = {
  id: string;
  name: string;
  code: string;
  is_default: boolean;
};

const MEDIDA = (v: number | null, u: string | null) =>
  v == null ? null : `${new Intl.NumberFormat("es-AR").format(v)} ${u ?? ""}`.trim();

/**
 * Trae los productos que coinciden con los filtros del listado (mismos
 * parámetros que `/panel/[cat]/productos`) con el precio del nivel elegido,
 * para las vistas imprimibles.
 */
export async function datosImpresion(slug: string, sp: SP) {
  const catalogo = await resolverCatalogo(slug);
  const supabase = await createClient();

  const estado =
    sp.estado === "active" || sp.estado === "inactive" ? sp.estado : undefined;
  const stock = sp.stock === "low" || sp.stock === "ok" ? sp.stock : undefined;

  const [{ data: tiersRaw }, { data: filas }] = await Promise.all([
    supabase
      .from("price_tiers")
      .select("id, name, code, is_default, is_active, sort_order")
      .eq("catalog_id", catalogo.id)
      .order("sort_order"),
    supabase.rpc("search_products", {
      p_catalog_id: catalogo.id,
      p_q: sp.q?.trim() || undefined,
      p_category_id: sp.categoria || undefined,
      p_brand: sp.marca || undefined,
      p_supplier_id: sp.proveedor || undefined,
      p_status: estado,
      p_stock: stock,
      p_include_deleted: false,
      p_sort: "name",
      p_dir: "asc",
      p_limit: 2000,
      p_offset: 0,
    }),
  ]);

  const tiers: Tier[] = (tiersRaw ?? [])
    .filter((t) => t.is_active)
    .map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      is_default: t.is_default,
    }));
  const tier =
    tiers.find((t) => t.code === sp.tier || t.id === sp.tier) ??
    tiers.find((t) => t.is_default) ??
    tiers[0] ??
    null;

  const ids = (filas ?? []).map((f) => f.id);
  const pres = new Map<string, PresentacionImpr[]>();
  if (ids.length) {
    const { data: variantes } = await supabase
      .from("product_variants")
      .select(
        "product_id, name, size_value, size_unit, cost, variant_prices(price, price_tier_id)",
      )
      .in("product_id", ids)
      .eq("is_deleted", false)
      .order("position");
    for (const v of variantes ?? []) {
      const lista = pres.get(v.product_id) ?? [];
      const vp = tier
        ? (v.variant_prices ?? []).find((x) => x.price_tier_id === tier.id)
        : undefined;
      lista.push({
        nombre: v.name,
        medida: MEDIDA(v.size_value, v.size_unit),
        precio: vp ? Number(vp.price) : null,
        costo: v.cost != null ? Number(v.cost) : null,
      });
      pres.set(v.product_id, lista);
    }
  }

  const productos: ProductoImpr[] = (filas ?? []).map((f) => {
    const lista = pres.get(f.id) ?? [];
    const precios = lista
      .map((p) => p.precio)
      .filter((x): x is number => x != null);
    return {
      id: f.id,
      nombre: f.name,
      marca: f.brand,
      sku: f.base_sku,
      categoria: f.category_name,
      proveedor: f.supplier_name,
      imagen: f.primary_image,
      presentaciones: lista,
      precioMin: precios.length ? Math.min(...precios) : null,
      precioMax: precios.length ? Math.max(...precios) : null,
    };
  });

  return { catalogo, productos, tiers, tier, filtros: sp };
}

/** Descripción legible de los filtros aplicados, para el encabezado. */
export function resumenFiltros(
  sp: SP,
  extras: { categoria?: string } = {},
): string {
  const partes: string[] = [];
  if (sp.q) partes.push(`"${sp.q}"`);
  if (extras.categoria) partes.push(extras.categoria);
  if (sp.marca) partes.push(sp.marca);
  if (sp.estado === "inactive") partes.push("inactivos");
  if (sp.stock === "low") partes.push("stock bajo");
  return partes.join(" · ");
}
