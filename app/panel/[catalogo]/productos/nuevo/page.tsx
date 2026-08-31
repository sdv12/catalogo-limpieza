import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { resolverCatalogo, puedeEditar } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { opcionesCategoria, tiersDelCatalogo } from "@/lib/catalog-data";
import { ProductForm } from "@/components/products/ProductForm";

export const metadata = { title: "Nuevo producto" };

export default async function NuevoProductoPage({
  params,
}: {
  params: Promise<{ catalogo: string }>;
}) {
  const { catalogo: slug } = await params;
  const catalogo = await resolverCatalogo(slug);
  if (!puedeEditar(catalogo)) notFound();

  const supabase = await createClient();
  const [categorias, tiers] = await Promise.all([
    opcionesCategoria(supabase, catalogo.id),
    tiersDelCatalogo(supabase, catalogo.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        href={`/panel/${slug}/productos`}
        className="inline-flex items-center gap-1 text-sm text-texto-sec hover:text-texto"
      >
        <ChevronLeft size={16} />
        Productos
      </Link>
      <h1 className="text-xl font-semibold text-texto">Nuevo producto</h1>

      <ProductForm
        slug={slug}
        catalogId={catalogo.id}
        categorias={categorias}
        tiers={tiers}
      />
    </div>
  );
}
