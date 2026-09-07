import { notFound } from "next/navigation";
import { resolverCatalogo, esAdminCatalogo } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { PromosManager, type PromoFila } from "@/components/promos/PromosManager";

export const metadata = { title: "Promos — Catálogo" };

export default async function PromosPage({
  params,
}: {
  params: Promise<{ catalogo: string }>;
}) {
  const { catalogo: slug } = await params;
  const catalogo = await resolverCatalogo(slug);
  if (!esAdminCatalogo(catalogo)) notFound();
  const supabase = await createClient();

  const { data } = await supabase
    .from("promotions")
    .select(
      "id, kind, product_id, title, subtitle, link, discount_type, discount_value, position, is_active, starts_at, ends_at, products(name, brand, base_sku)",
    )
    .eq("catalog_id", catalogo.id)
    .order("kind")
    .order("position");

  const promos: PromoFila[] = (data ?? []).map((p) => ({
    id: p.id,
    kind: p.kind as PromoFila["kind"],
    product_id: p.product_id,
    product_name: (p.products as { name: string } | null)?.name ?? "Producto",
    title: p.title,
    subtitle: p.subtitle,
    link: p.link,
    discount_type: p.discount_type as PromoFila["discount_type"],
    discount_value: p.discount_value,
    position: p.position,
    is_active: p.is_active,
    starts_at: p.starts_at,
    ends_at: p.ends_at,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-texto">Promos</h1>
        <p className="mt-1 text-sm text-texto-sec">
          Carrusel, destacados y ofertas del catálogo. El orden 1 es el primero
          que se muestra; podés programar desde/hasta.
        </p>
      </div>
      <PromosManager slug={slug} promos={promos} />
    </div>
  );
}
