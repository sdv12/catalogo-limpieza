import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, History } from "lucide-react";
import { resolverCatalogo, puedeEditar, tienePermiso } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { opcionesCategoria, tiersDelCatalogo } from "@/lib/catalog-data";
import { imagenUrl } from "@/lib/storage";
import { Badge } from "@/components/ui/Badge";
import { ProductForm, type ProductoExistente } from "@/components/products/ProductForm";
import { ProductSuppliers } from "@/components/products/ProductSuppliers";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ catalogo: string; id: string }>;
}) {
  const { catalogo: slug, id } = await params;
  const catalogo = await resolverCatalogo(slug);
  const supabase = await createClient();

  const { data: prod } = await supabase
    .from("products")
    .select(
      `id, name, description, brand, base_sku, primary_category_id, status, is_deleted,
       product_categories(category_id, is_primary),
       product_images(storage_path, alt, position, is_primary),
       product_variants(id, name, sku, size_value, size_unit, barcode, cost, stock, min_stock, position, is_deleted,
         variant_prices(price_tier_id, price))`,
    )
    .eq("id", id)
    .eq("catalog_id", catalogo.id)
    .maybeSingle();

  if (!prod) notFound();

  const [categorias, tiers, { data: vinculosRaw }, { data: proveedores }] =
    await Promise.all([
      opcionesCategoria(supabase, catalogo.id),
      tiersDelCatalogo(supabase, catalogo.id),
      supabase
        .from("product_suppliers")
        .select(
          "supplier_id, supplier_sku, cost, lead_time_days, is_primary, suppliers(name)",
        )
        .eq("product_id", id),
      supabase
        .from("suppliers")
        .select("id, name")
        .eq("catalog_id", catalogo.id)
        .eq("is_deleted", false)
        .eq("is_active", true)
        .order("name"),
    ]);

  const vinculos = (vinculosRaw ?? []).map((v) => ({
    supplier_id: v.supplier_id,
    supplier_name:
      (v.suppliers as { name: string } | null)?.name ?? "Proveedor",
    supplier_sku: v.supplier_sku,
    cost: v.cost != null ? Number(v.cost) : null,
    lead_time_days: v.lead_time_days,
    is_primary: v.is_primary,
  }));

  const existente: ProductoExistente = {
    id: prod.id,
    name: prod.name,
    description: prod.description,
    brand: prod.brand,
    base_sku: prod.base_sku,
    primary_category_id: prod.primary_category_id,
    status: prod.status,
    extraCategoryIds: (prod.product_categories ?? [])
      .filter((c) => !c.is_primary)
      .map((c) => c.category_id),
    images: [...(prod.product_images ?? [])]
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position)
      .map((i) => ({
        path: i.storage_path,
        url: imagenUrl(i.storage_path),
        alt: i.alt,
      })),
    variants: [...(prod.product_variants ?? [])]
      .filter((v) => !v.is_deleted)
      .sort((a, b) => a.position - b.position)
      .map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        size_value: v.size_value,
        size_unit: v.size_unit,
        barcode: v.barcode,
        cost: v.cost != null ? Number(v.cost) : null,
        stock: Number(v.stock),
        min_stock: Number(v.min_stock),
        prices: Object.fromEntries(
          (v.variant_prices ?? []).map((p) => [p.price_tier_id, Number(p.price)]),
        ),
      })),
  };

  const soloLectura = !puedeEditar(catalogo);
  const verCostos = tienePermiso(catalogo, "costos");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/panel/${slug}/productos`}
          className="inline-flex items-center gap-1 text-sm text-texto-sec hover:text-texto"
        >
          <ChevronLeft size={16} />
          Productos
        </Link>
        <Link
          href={`/panel/${slug}/productos/${id}/historial`}
          className="inline-flex items-center gap-1 text-sm text-primario hover:underline"
        >
          <History size={15} />
          Ver historial
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-texto">{prod.name}</h1>
        {prod.is_deleted && <Badge tono="error">Dado de baja</Badge>}
        {soloLectura && <Badge tono="alerta">Solo lectura</Badge>}
      </div>

      {soloLectura ? (
        <p className="text-sm text-texto-sec">
          No tenés permiso de edición en este catálogo.
        </p>
      ) : (
        <div className="space-y-5 pb-24">
          <ProductForm
            slug={slug}
            catalogId={catalogo.id}
            categorias={categorias}
            tiers={tiers}
            producto={existente}
            puedeEditarPrecios={puedeEditar(catalogo)}
          />
          {verCostos && (
            <ProductSuppliers
              slug={slug}
              productId={prod.id}
              vinculos={vinculos}
              proveedores={proveedores ?? []}
            />
          )}
        </div>
      )}
    </div>
  );
}
