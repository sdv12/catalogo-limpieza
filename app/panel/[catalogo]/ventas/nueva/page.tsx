import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { resolverCatalogo, puedeEditar, esAdminCatalogo, tienePermiso } from "@/lib/dal";
import { OrderForm, type ClienteVenta } from "@/components/ventas/OrderForm";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Nueva venta — Catálogo" };

export default async function NuevaVentaPage({
  params,
  searchParams,
}: {
  params: Promise<{ catalogo: string }>;
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { catalogo: slug } = await params;
  const { cliente: clienteId } = await searchParams;
  const catalogo = await resolverCatalogo(slug);
  if (!puedeEditar(catalogo)) notFound();

  let clienteInicial: ClienteVenta | null = null;
  if (clienteId && /^[0-9a-f-]{36}$/i.test(clienteId)) {
    const supabase = await createClient();
    const { data: c } = await supabase
      .from("customers")
      .select("id, name, doc_number, balance, credit_limit")
      .eq("id", clienteId)
      .eq("catalog_id", catalogo.id)
      .eq("is_deleted", false)
      .maybeSingle();
    if (c) {
      clienteInicial = {
        id: c.id,
        name: c.name,
        doc: c.doc_number,
        balance: Number(c.balance),
        creditLimit: Number(c.credit_limit),
      };
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        href={`/panel/${slug}/ventas`}
        className="inline-flex items-center gap-1 text-sm text-texto-sec hover:text-texto"
      >
        <ChevronLeft size={16} />
        Ventas
      </Link>
      <h1 className="text-xl font-semibold text-texto">Nueva venta</h1>
      <OrderForm
        slug={slug}
        clienteInicial={clienteInicial}
        puedeCambiarPrecio={tienePermiso(catalogo, "precios_especiales")}
        esAdmin={esAdminCatalogo(catalogo)}
      />
    </div>
  );
}
