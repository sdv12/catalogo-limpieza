import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { resolverCatalogo, puedeEditar, verificarSesion } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/Card";
import { AbrirCaja } from "@/components/caja/CajaControles";
import { CobroForm } from "@/components/caja/CobroForm";

export const metadata = { title: "Cobrar — Catálogo" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function CobrarPage({
  params,
  searchParams,
}: {
  params: Promise<{ catalogo: string }>;
  searchParams: Promise<{ cliente?: string; pedido?: string }>;
}) {
  const { catalogo: slug } = await params;
  const sp = await searchParams;
  const catalogo = await resolverCatalogo(slug);
  if (!puedeEditar(catalogo)) notFound();
  const user = await verificarSesion();
  const supabase = await createClient();

  const { data: caja } = await supabase
    .from("cash_sessions")
    .select("id")
    .eq("catalog_id", catalogo.id)
    .eq("user_id", user.userId)
    .eq("status", "abierta")
    .maybeSingle();

  let cliente = null;
  if (sp.cliente && UUID.test(sp.cliente)) {
    const { data: c } = await supabase
      .from("customers")
      .select("id, name, doc_number, balance")
      .eq("id", sp.cliente)
      .eq("catalog_id", catalogo.id)
      .maybeSingle();
    if (c) cliente = { id: c.id, name: c.name, doc: c.doc_number, balance: Number(c.balance) };
  }

  let pedido = null;
  if (sp.pedido && UUID.test(sp.pedido)) {
    const { data: o } = await supabase
      .from("orders")
      .select("id, number, total, paid_total, payment_terms, status, contact_name, customer:customers(name)")
      .eq("id", sp.pedido)
      .eq("catalog_id", catalogo.id)
      .maybeSingle();
    if (o && o.payment_terms === "contado") {
      pedido = {
        id: o.id,
        number: o.number,
        falta: Math.max(0, Math.round((Number(o.total) - Number(o.paid_total)) * 100) / 100),
        cliente: o.customer?.name ?? o.contact_name,
      };
    }
  }

  const volver = pedido ? `/panel/${slug}/ventas/${pedido.id}` : cliente ? `/panel/${slug}/clientes/${cliente.id}` : `/panel/${slug}/caja`;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href={volver} className="inline-flex items-center gap-1 text-sm text-texto-sec hover:text-texto">
        <ChevronLeft size={16} />
        Volver
      </Link>
      <h1 className="text-xl font-semibold text-texto">Registrar cobro</h1>

      {!caja ? (
        <Card>
          <CardBody className="space-y-3">
            <p className="text-sm text-texto">Para cobrar primero abrí tu caja.</p>
            <AbrirCaja slug={slug} />
          </CardBody>
        </Card>
      ) : pedido && pedido.falta <= 0 ? (
        <p className="text-sm text-texto-sec">Este pedido ya está cobrado.</p>
      ) : (
        <CobroForm slug={slug} cliente={cliente} pedido={pedido} />
      )}
    </div>
  );
}
