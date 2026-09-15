import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { resolverCatalogo, puedeEditar, tienePermiso } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { tiersDelCatalogo, vendedoresDelCatalogo } from "@/lib/catalog-data";
import { Badge } from "@/components/ui/Badge";
import {
  CustomerForm,
  type ClienteExistente,
} from "@/components/customers/CustomerForm";
import { CustomerLedger, type MovimientoFila } from "@/components/customers/CustomerLedger";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ catalogo: string; id: string }>;
}) {
  const { catalogo: slug, id } = await params;
  const catalogo = await resolverCatalogo(slug);
  const supabase = await createClient();

  const [{ data: cli }, tiers, vendedores, { data: movimientos }] =
    await Promise.all([
      supabase
        .from("customers")
        .select(
          "id, name, doc_type, doc_number, tax_condition, email, phone, address, city, province, price_tier_id, assigned_seller, credit_limit, notes, is_active, is_deleted, balance, next_due_date",
        )
        .eq("id", id)
        .eq("catalog_id", catalogo.id)
        .maybeSingle(),
      tiersDelCatalogo(supabase, catalogo.id),
      vendedoresDelCatalogo(supabase, catalogo.id),
      supabase
        .from("customer_transactions")
        .select("id, kind, amount, due_date, note, created_at")
        .eq("customer_id", id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
  if (!cli) notFound();

  const existente: ClienteExistente = {
    ...cli,
    credit_limit: Number(cli.credit_limit),
  };
  const editable = puedeEditar(catalogo);
  const puedeCorregir = tienePermiso(catalogo, "cuenta_corriente_admin");

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
        {!editable && <Badge tono="alerta">Solo lectura</Badge>}
      </div>

      {editable ? (
        <CustomerForm slug={slug} tiers={tiers} vendedores={vendedores} cliente={existente} />
      ) : (
        <p className="text-sm text-texto-sec">
          No tenés permiso de edición en este catálogo.
        </p>
      )}

      {!cli.is_deleted && (
        <CustomerLedger
          slug={slug}
          customerId={id}
          balance={Number(cli.balance)}
          nextDueDate={cli.next_due_date}
          movimientos={(movimientos ?? []).map(
            (m): MovimientoFila => ({
              ...m,
              kind: m.kind as MovimientoFila["kind"],
              amount: Number(m.amount),
            }),
          )}
          puedeCargar={editable}
          puedeCorregir={puedeCorregir}
        />
      )}
    </div>
  );
}
