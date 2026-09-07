import { notFound } from "next/navigation";
import { resolverCatalogo, esAdminCatalogo } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { opcionesCategoria } from "@/lib/catalog-data";
import { TiersManager } from "@/components/prices/TiersManager";
import { BulkPriceTool } from "@/components/prices/BulkPriceTool";

export const metadata = { title: "Precios — Catálogo" };

export default async function PreciosPage({
  params,
}: {
  params: Promise<{ catalogo: string }>;
}) {
  const { catalogo: slug } = await params;
  const catalogo = await resolverCatalogo(slug);
  if (!esAdminCatalogo(catalogo)) notFound();
  const supabase = await createClient();

  const [{ data: tiers }, categorias] = await Promise.all([
    supabase
      .from("price_tiers")
      .select("id, name, code, is_active, is_default")
      .eq("catalog_id", catalogo.id)
      .order("sort_order"),
    opcionesCategoria(supabase, catalogo.id),
  ]);

  const soloLectura = false;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-texto">Precios</h1>
        <p className="mt-1 text-sm text-texto-sec">
          Niveles de precio del catálogo y actualización en lote.
        </p>
      </div>

      <TiersManager slug={slug} tiers={tiers ?? []} soloLectura={soloLectura} />

      <BulkPriceTool
        slug={slug}
        tiers={(tiers ?? []).filter((t) => t.is_active)}
        categorias={categorias}
        soloLectura={soloLectura}
      />
    </div>
  );
}
