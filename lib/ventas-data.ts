import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CatalogoAccesible } from "@/lib/roles";
import { tienePermiso } from "@/lib/roles";
import type { EstadoPedido, CanalPedido, CondicionPago } from "@/lib/ventas";

export type PedidoDetalle = {
  id: string;
  number: number;
  status: EstadoPedido;
  channel: CanalPedido;
  channelName: string | null;
  externalRef: string | null;
  payment: CondicionPago;
  dueDate: string | null;
  notes: string | null;
  total: number;
  createdAt: string;
  confirmedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  contacto: {
    nombre: string | null;
    telefono: string | null;
    email: string | null;
    direccion: string | null;
  };
  cliente: {
    id: string;
    name: string;
    doc: string | null;
    balance: number;
    creditLimit: number;
    address: string | null;
    phone: string | null;
  } | null;
  items: {
    id: string;
    variantId: string;
    producto: string;
    presentacion: string;
    sku: string;
    cantidad: number;
    precioLista: number | null;
    precio: number;
    origen: "lista" | "especial" | "manual";
    motivo: string | null;
    guardarFijo: boolean;
    costo: number | null;
    subtotal: number;
    stockActual: number;
  }[];
};

export async function cargarPedido(
  catalogo: CatalogoAccesible,
  id: string,
): Promise<PedidoDetalle | null> {
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("orders")
    .select(
      "id, number, status, channel, channel_name, external_ref, payment_terms, due_date, notes, total, created_at, confirmed_at, delivered_at, cancelled_at, cancel_reason, contact_name, contact_phone, contact_email, delivery_address, customer:customers(id, name, doc_number, balance, credit_limit, address, phone), order_items(id, variant_id, product_name, variant_name, sku, quantity, list_price, unit_price, price_source, price_reason, save_special, unit_cost, line_total, position, variant:product_variants(stock))",
    )
    .eq("id", id)
    .eq("catalog_id", catalogo.id)
    .maybeSingle();
  if (!o) return null;

  const verCosto = tienePermiso(catalogo, "costos");
  return {
    id: o.id,
    number: o.number,
    status: o.status as EstadoPedido,
    channel: o.channel as CanalPedido,
    channelName: o.channel_name,
    externalRef: o.external_ref,
    payment: o.payment_terms as CondicionPago,
    dueDate: o.due_date,
    notes: o.notes,
    total: Number(o.total),
    createdAt: o.created_at,
    confirmedAt: o.confirmed_at,
    deliveredAt: o.delivered_at,
    cancelledAt: o.cancelled_at,
    cancelReason: o.cancel_reason,
    contacto: {
      nombre: o.contact_name,
      telefono: o.contact_phone,
      email: o.contact_email,
      direccion: o.delivery_address,
    },
    cliente: o.customer
      ? {
          id: o.customer.id,
          name: o.customer.name,
          doc: o.customer.doc_number,
          balance: Number(o.customer.balance),
          creditLimit: Number(o.customer.credit_limit),
          address: o.customer.address,
          phone: o.customer.phone,
        }
      : null,
    items: [...o.order_items]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({
        id: i.id,
        variantId: i.variant_id,
        producto: i.product_name,
        presentacion: i.variant_name,
        sku: i.sku,
        cantidad: Number(i.quantity),
        precioLista: i.list_price != null ? Number(i.list_price) : null,
        precio: Number(i.unit_price),
        origen: i.price_source as "lista" | "especial" | "manual",
        motivo: i.price_reason,
        guardarFijo: i.save_special,
        costo: verCosto && i.unit_cost != null ? Number(i.unit_cost) : null,
        subtotal: Number(i.line_total),
        stockActual: Number(i.variant?.stock ?? 0),
      })),
  };
}
