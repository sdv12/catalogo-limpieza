import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { resolverCatalogo, puedeEditar, tienePermiso } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { tiersDelCatalogo, vendedoresDelCatalogo } from "@/lib/catalog-data";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatearFecha, formatearMoneda } from "@/lib/format";
import {
  ETIQUETA_ESTADO_PEDIDO,
  TONO_ESTADO_PEDIDO,
  type EstadoPedido,
} from "@/lib/ventas";
import {
  CustomerForm,
  type ClienteExistente,
} from "@/components/customers/CustomerForm";
import { CustomerLedger, type MovimientoFila } from "@/components/customers/CustomerLedger";
import {
  CustomerSpecialPrices,
  type PrecioEspecialFila,
} from "@/components/customers/CustomerSpecialPrices";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ catalogo: string; id: string }>;
}) {
  const { catalogo: slug, id } = await params;
  const catalogo = await resolverCatalogo(slug);
  const supabase = await createClient();

  const [
    { data: cli },
    tiers,
    vendedores,
    { data: movimientos },
    { data: especiales },
    { data: pedidos },
  ] =
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
      supabase
        .from("customer_prices")
        .select(
          "id, price, reason, ends_on, updated_at, variant:product_variants!inner(id, name, sku, product:products!inner(name), variant_prices(price, price_tier_id))",
        )
        .eq("customer_id", id)
        .eq("catalog_id", catalogo.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("orders")
        .select("id, number, status, total, created_at")
        .eq("customer_id", id)
        .eq("catalog_id", catalogo.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
  if (!cli) notFound();

  const existente: ClienteExistente = {
    ...cli,
    credit_limit: Number(cli.credit_limit),
  };
  const editable = puedeEditar(catalogo);
  const puedeCorregir = tienePermiso(catalogo, "cuenta_corriente_admin");

  // "Precio general" del cliente = su nivel, o el nivel por defecto del catálogo.
  const nivel =
    tiers.find((t) => t.id === cli.price_tier_id) ?? tiers.find((t) => t.is_default) ?? null;
  const preciosEspeciales: PrecioEspecialFila[] = (especiales ?? []).map((e) => ({
    id: e.id,
    variantId: e.variant.id,
    producto: e.variant.product.name,
    presentacion: e.variant.name,
    sku: e.variant.sku,
    precioGeneral:
      e.variant.variant_prices.find((p) => p.price_tier_id === nivel?.id)?.price ?? null,
    precio: Number(e.price),
    motivo: e.reason,
    vence: e.ends_on,
    actualizado: e.updated_at,
  }));

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
        <CustomerForm slug={slug} tiers={tiers} vendedores={vendedores} cliente={existente} puedeCambiarNivel={tienePermiso(catalogo, "precios_lote")} />
      ) : (
        <p className="text-sm text-texto-sec">
          No tenés permiso de edición en este catálogo.
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Últimos pedidos</CardTitle>
          {editable && !cli.is_deleted && (
            <Link
              href={`/panel/${slug}/ventas/nueva?cliente=${id}`}
              className="text-sm text-primario hover:underline"
            >
              Nueva venta
            </Link>
          )}
        </CardHeader>
        <CardBody>
          {(pedidos ?? []).length === 0 ? (
            <p className="text-sm text-texto-tenue">Todavía no tiene pedidos.</p>
          ) : (
            <ul className="divide-y divide-linea text-sm">
              {(pedidos ?? []).map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-2">
                  <Link
                    href={`/panel/${slug}/ventas/${o.id}`}
                    className="font-medium tabular-nums text-primario hover:underline"
                  >
                    #{o.number}
                  </Link>
                  <span className="text-texto-sec">{formatearFecha(o.created_at)}</span>
                  <Badge tono={TONO_ESTADO_PEDIDO[o.status as EstadoPedido]}>
                    {ETIQUETA_ESTADO_PEDIDO[o.status as EstadoPedido]}
                  </Badge>
                  <span className="ml-auto tabular-nums text-texto">
                    {formatearMoneda(Number(o.total))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {!cli.is_deleted && (
        <CustomerSpecialPrices
          slug={slug}
          customerId={id}
          nivel={nivel?.name ?? null}
          precios={preciosEspeciales}
          puedeEditar={tienePermiso(catalogo, "precios_especiales")}
        />
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
