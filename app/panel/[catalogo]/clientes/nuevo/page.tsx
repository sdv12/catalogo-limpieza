import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { resolverCatalogo, puedeEditar } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { tiersDelCatalogo } from "@/lib/catalog-data";
import { CustomerForm } from "@/components/customers/CustomerForm";

export const metadata = { title: "Nuevo cliente" };

export default async function NuevoClientePage({
  params,
}: {
  params: Promise<{ catalogo: string }>;
}) {
  const { catalogo: slug } = await params;
  const catalogo = await resolverCatalogo(slug);
  if (!puedeEditar(catalogo)) notFound();

  const supabase = await createClient();
  const tiers = await tiersDelCatalogo(supabase, catalogo.id);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href={`/panel/${slug}/clientes`}
        className="inline-flex items-center gap-1 text-sm text-texto-sec hover:text-texto"
      >
        <ChevronLeft size={16} />
        Clientes
      </Link>
      <h1 className="text-xl font-semibold text-texto">Nuevo cliente</h1>
      <CustomerForm slug={slug} tiers={tiers} />
    </div>
  );
}
