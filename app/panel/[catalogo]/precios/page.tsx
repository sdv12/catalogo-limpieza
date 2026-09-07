import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { resolverCatalogo, esAdminCatalogo } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/Card";
import { TiersManager } from "@/components/prices/TiersManager";

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

  const { data: tiers } = await supabase
    .from("price_tiers")
    .select("id, name, code, is_active, is_default")
    .eq("catalog_id", catalogo.id)
    .order("sort_order");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-texto">Precios</h1>
        <p className="mt-1 text-sm text-texto-sec">
          Niveles de precio del catálogo.
        </p>
      </div>

      <TiersManager slug={slug} tiers={tiers ?? []} soloLectura={false} />

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-texto">
              Actualización de precios en lote
            </p>
            <p className="text-sm text-texto-sec">
              Ahora se hace desde Productos: filtrá por marca, proveedor, categoría o
              búsqueda y aplicá el ajuste a lo que quede en pantalla.
            </p>
          </div>
          <Link
            href={`/panel/${slug}/productos`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-comp-sm border border-linea-fuerte bg-superficie px-3 py-1.5 text-sm text-texto hover:bg-superficie-sec"
          >
            Ir a Productos
            <ArrowRight size={14} />
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
