import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { resolverCatalogo, puedeEditar } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import {
  SupplierForm,
  type ProveedorExistente,
} from "@/components/suppliers/SupplierForm";

export default async function EditarProveedorPage({
  params,
}: {
  params: Promise<{ catalogo: string; id: string }>;
}) {
  const { catalogo: slug, id } = await params;
  const catalogo = await resolverCatalogo(slug);
  const supabase = await createClient();

  const { data: prov } = await supabase
    .from("suppliers")
    .select(
      "id, name, doc_type, doc_number, contact_name, email, phone, address, city, province, payment_terms, notes, is_active, is_deleted",
    )
    .eq("id", id)
    .eq("catalog_id", catalogo.id)
    .maybeSingle();
  if (!prov) notFound();

  const existente: ProveedorExistente = prov;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href={`/panel/${slug}/proveedores`}
        className="inline-flex items-center gap-1 text-sm text-texto-sec hover:text-texto"
      >
        <ChevronLeft size={16} />
        Proveedores
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-texto">{prov.name}</h1>
        {prov.is_deleted && <Badge tono="error">Eliminado</Badge>}
        {!puedeEditar(catalogo) && <Badge tono="alerta">Solo lectura</Badge>}
      </div>

      {puedeEditar(catalogo) ? (
        <SupplierForm slug={slug} proveedor={existente} />
      ) : (
        <p className="text-sm text-texto-sec">
          No tenés permiso de edición en este catálogo.
        </p>
      )}
    </div>
  );
}
