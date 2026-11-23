import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CatalogoAccesible } from "@/lib/roles";
import { enviarMail, mailHabilitado } from "@/lib/mail";
import { formatearFechaHora, formatearMoneda } from "@/lib/format";
import { ETIQUETA_METODO_PAGO, type MetodoPago } from "@/lib/ventas";

export type ReciboDetalle = {
  id: string;
  number: number;
  total: number;
  note: string | null;
  status: "valido" | "anulado";
  voidReason: string | null;
  voidedAt: string | null;
  emailedAt: string | null;
  createdAt: string;
  cliente: { id: string; name: string; doc: string | null; email: string | null } | null;
  pedido: { id: string; number: number } | null;
  lineas: { method: MetodoPago; amount: number; reference: string | null }[];
};

export async function cargarRecibo(
  catalogo: CatalogoAccesible,
  id: string,
): Promise<ReciboDetalle | null> {
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("receipts")
    .select(
      "id, number, total, note, status, void_reason, voided_at, emailed_at, created_at, customer:customers(id, name, doc_number, email), order:orders(id, number), receipt_lines(method, amount, reference)",
    )
    .eq("id", id)
    .eq("catalog_id", catalogo.id)
    .maybeSingle();
  if (!r) return null;
  return {
    id: r.id,
    number: r.number,
    total: Number(r.total),
    note: r.note,
    status: r.status as "valido" | "anulado",
    voidReason: r.void_reason,
    voidedAt: r.voided_at,
    emailedAt: r.emailed_at,
    createdAt: r.created_at,
    cliente: r.customer
      ? { id: r.customer.id, name: r.customer.name, doc: r.customer.doc_number, email: r.customer.email }
      : null,
    pedido: r.order ? { id: r.order.id, number: r.order.number } : null,
    lineas: r.receipt_lines.map((l) => ({
      method: l.method as MetodoPago,
      amount: Number(l.amount),
      reference: l.reference,
    })),
  };
}

/**
 * Manda el recibo por mail al cliente si tiene email y el envío está
 * configurado. Nunca hace fallar el cobro: devuelve si se mandó.
 */
export async function enviarReciboPorMail(
  catalogo: CatalogoAccesible,
  reciboId: string,
): Promise<boolean> {
  if (!mailHabilitado()) return false;
  const r = await cargarRecibo(catalogo, reciboId);
  const to = r?.cliente?.email?.trim();
  if (!r || !to) return false;

  const lineas = r.lineas
    .map((l) => `- ${ETIQUETA_METODO_PAGO[l.method]}: ${formatearMoneda(l.amount)}${l.reference ? ` (${l.reference})` : ""}`)
    .join("\n");
  const text = `Hola ${r.cliente!.name},

Te enviamos el recibo de tu pago a ${catalogo.name}.

Recibo N° ${r.number} — ${formatearFechaHora(r.createdAt)}
${r.pedido ? `Pedido #${r.pedido.number}\n` : ""}
${lineas}

Total recibido: ${formatearMoneda(r.total)}

¡Gracias!
${catalogo.name}`;

  const ok = await enviarMail({ to, subject: `Recibo N° ${r.number} — ${catalogo.name}`, text });
  if (ok) {
    const supabase = await createClient();
    await supabase.rpc("marcar_recibo_enviado", { p_receipt: r.id });
  }
  return ok;
}
