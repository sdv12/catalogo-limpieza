import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { resolverCatalogo, puedeEditar } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { tiersDelCatalogo } from "@/lib/catalog-data";
import { Badge } from "@/components/ui/Badge";
import {
  CustomerForm,
  type ClienteExistente,
} from "@/components/customers/CustomerForm";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ catalogo: string; id: string }>;
}) {
  const { catalogo: slug, id } = await params;
  const catalogo = await resolverCatalogo(slug);
  const supabase = await createClient();

  const { data: cli } = await supabase
    .from("customers")
    .select(
      "id, name, doc_type, doc_number, tax_condition, email, phone, address, city, province, price_tier_id, credit_limit, notes, is_active, is_deleted",
    )
    .eq("id", id)
    .eq("catalog_id", catalogo.id)
    .maybeSingle();
  if (!cli) notFound();

  const tiers = await tiersDelCatalogo(supabase, catalogo.id);

  const existente: ClienteExistente = {
    ...cli,
    credit_limit: Number(cli.credit_limit),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href={`/panel/${slug}/clientes`}
        className="inline-flex items-center gap-1 text-sm text-texto-sec hover:text-texto"
      >
        <ChevronLeft size={16} />
        Clientes
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-texto">{cli.name}</h1>
        {cli.is_deleted && <Badge tono="error">Eliminado</Badge>}
        {!puedeEditar(catalogo) && <Badge tono="alerta">Solo lectura</Badge>}
      </div>

      {puedeEditar(catalogo) ? (
        <CustomerForm slug={slug} tiers={tiers} cliente={existente} />
      ) : (
        <p className="text-sm text-texto-sec">
          No tenés permiso de edición en este catálogo.
        </p>
      )}
    </div>
  );
}
