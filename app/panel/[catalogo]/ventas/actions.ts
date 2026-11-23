"use server";

import { randomBytes } from "node:crypto";
import { hashClave } from "@/lib/canales";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  exigirAdmin,
  exigirEdicion,
  type ResultadoAccion,
} from "@/lib/guards";
import { resolverCatalogo } from "@/lib/dal";
import { tienePermiso } from "@/lib/roles";
import { sanitizarBusqueda } from "@/lib/format";
import { ventaSchema, type VentaInput } from "@/lib/validation/venta";
import { lineasPagoSchema } from "@/lib/validation/cobro";
import { enviarReciboPorMail } from "@/lib/recibos";
import {
  CANALES_EXTERNOS,
  ESTADOS_PEDIDO,
  type CanalExterno,
  type EstadoPedido,
  type LineaPago,
} from "@/lib/ventas";

/** Cómo se cobra una venta de contado al confirmarla. */
export type CobroConfirmacion = { pagos: LineaPago[] | null; cobrarAlEntregar: boolean };

function validarCobro(c: CobroConfirmacion): string | null {
  if (c.cobrarAlEntregar || !c.pagos) return null;
  const r = lineasPagoSchema.safeParse(c.pagos);
  return r.success ? null : r.error.issues[0].message;
}

function rev(slug: string, id?: string) {
  revalidatePath(`/panel/${slug}/ventas`);
  if (id) revalidatePath(`/panel/${slug}/ventas/${id}`);
  revalidatePath(`/panel/${slug}`, "layout");
}

/** Los errores de las funciones de la base ya vienen en castellano. */
function mensaje(error: { message: string } | null, porDefecto: string): string {
  return error?.message?.trim() || porDefecto;
}

// ------------------------------------------------------------
// Buscador de productos para la venta
// ------------------------------------------------------------
export type ProductoVenta = {
  variantId: string;
  producto: string;
  presentacion: string;
  sku: string;
  stock: number;
  /** Precio que le corresponde al cliente (o el general si no hay cliente). */
  precio: number | null;
  origen: "lista" | "especial";
  /** Solo si el usuario puede ver costos. */
  costo: number | null;
};

export async function buscarProductosVenta(
  slug: string,
  customerId: string | null,
  q: string,
): Promise<ProductoVenta[]> {
  const catalogo = await resolverCatalogo(slug);
  const t = sanitizarBusqueda(q);
  if (t.length < 2) return [];
  const supabase = await createClient();

  const { data: productos } = await supabase
    .from("products")
    .select("id")
    .eq("catalog_id", catalogo.id)
    .eq("is_deleted", false)
    .eq("status", "active")
    .or(`name.ilike.%${t}%,base_sku.ilike.%${t}%,brand.ilike.%${t}%`)
    .limit(15);
  const ids = (productos ?? []).map((p) => p.id);
  const filtros = [`sku.ilike.%${t}%`];
  if (/^\d{6,14}$/.test(t)) filtros.push(`barcode.eq.${t}`);
  if (ids.length) filtros.push(`product_id.in.(${ids.join(",")})`);

  const [{ data: variantes }, { data: tiers }, cliente] = await Promise.all([
    supabase
      .from("product_variants")
      .select(
        "id, name, sku, stock, cost, product:products!inner(name, is_deleted, status), variant_prices(price, price_tier_id)",
      )
      .eq("catalog_id", catalogo.id)
      .eq("is_deleted", false)
      .eq("product.is_deleted", false)
      .eq("product.status", "active")
      .or(filtros.join(","))
      .order("name")
      .limit(25),
    supabase
      .from("price_tiers")
      .select("id, is_default")
      .eq("catalog_id", catalogo.id),
    customerId
      ? supabase
          .from("customers")
          .select("price_tier_id")
          .eq("id", customerId)
          .eq("catalog_id", catalogo.id)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);

  const tierDefault = (tiers ?? []).find((x) => x.is_default)?.id ?? null;
  const tierCliente = cliente?.price_tier_id ?? null;
  const vIds = (variantes ?? []).map((v) => v.id);

  const especiales = new Map<string, number>();
  if (customerId && vIds.length) {
    const hoy = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Argentina/Cordoba",
    });
    const { data } = await supabase
      .from("customer_prices")
      .select("variant_id, price, ends_on")
      .eq("customer_id", customerId)
      .in("variant_id", vIds);
    for (const e of data ?? []) {
      if (e.ends_on == null || e.ends_on >= hoy) especiales.set(e.variant_id, Number(e.price));
    }
  }

  const verCosto = tienePermiso(catalogo, "costos");
  return (variantes ?? []).map((v) => {
    const precioTier = (id: string | null) =>
      id ? v.variant_prices.find((p) => p.price_tier_id === id)?.price ?? null : null;
    const especial = especiales.get(v.id);
    return {
      variantId: v.id,
      producto: v.product.name,
      presentacion: v.name,
      sku: v.sku,
      stock: Number(v.stock),
      precio:
        especial ?? precioTier(tierCliente) ?? precioTier(tierDefault) ?? null,
      origen: especial != null ? "especial" : "lista",
      costo: verCosto && v.cost != null ? Number(v.cost) : null,
    };
  });
}

export async function buscarClientesVenta(
  slug: string,
  q: string,
): Promise<
  { id: string; name: string; doc: string | null; balance: number; creditLimit: number }[]
> {
  const catalogo = await resolverCatalogo(slug);
  const t = sanitizarBusqueda(q);
  if (t.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, name, doc_number, balance, credit_limit")
    .eq("catalog_id", catalogo.id)
    .eq("is_deleted", false)
    .eq("is_active", true)
    .or(`name.ilike.%${t}%,doc_number.ilike.%${t}%,email.ilike.%${t}%,phone.ilike.%${t}%`)
    .order("name")
    .limit(10);
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    doc: c.doc_number,
    balance: Number(c.balance),
    creditLimit: Number(c.credit_limit),
  }));
}

// ------------------------------------------------------------
// Pedido: guardar / confirmar / avanzar / cancelar
// ------------------------------------------------------------
export async function guardarPedido(
  slug: string,
  orderId: string | null,
  input: VentaInput,
  confirmar: CobroConfirmacion | null,
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  if (confirmar) {
    const e = validarCobro(confirmar);
    if (e) return { ok: false, message: e };
  }
  const parsed = ventaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const d = parsed.data;
  const supabase = await createClient();

  const { data: id, error } = await supabase.rpc("guardar_pedido", {
    p_catalog: catalogo.id,
    p_order: orderId,
    p_customer: d.customerId,
    p_payment: d.payment,
    p_due_date: d.dueDate,
    p_notes: d.notes,
    p_items: d.items.map((i) => ({
      variant_id: i.variantId,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      reason: i.reason,
      save_special: i.saveSpecial,
    })),
  });
  if (error || !id) return { ok: false, message: mensaje(error, "No se pudo guardar el pedido") };

  if (confirmar) {
    const { data: reciboId, error: eConf } = await supabase.rpc("confirmar_pedido", {
      p_order: id,
      p_pagos: confirmar.cobrarAlEntregar ? undefined : (confirmar.pagos ?? undefined),
      p_cobrar_al_entregar: confirmar.cobrarAlEntregar,
    });
    rev(slug, id);
    revalidatePath(`/panel/${slug}/caja`, "layout");
    if (reciboId) await enviarReciboPorMail(catalogo, reciboId);
    if (eConf) {
      return {
        ok: false,
        message: `El pedido quedó guardado como Nuevo, pero no se pudo confirmar: ${mensaje(eConf, "error")}`,
        data: { id },
      };
    }
    return { ok: true, message: "Venta confirmada", data: { id } };
  }

  rev(slug, id);
  return { ok: true, message: "Pedido guardado", data: { id } };
}

export async function confirmarPedido(
  slug: string,
  id: string,
  cobro: CobroConfirmacion,
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  const e = validarCobro(cobro);
  if (e) return { ok: false, message: e };
  const supabase = await createClient();
  const { data: reciboId, error } = await supabase.rpc("confirmar_pedido", {
    p_order: id,
    p_pagos: cobro.cobrarAlEntregar ? undefined : (cobro.pagos ?? undefined),
    p_cobrar_al_entregar: cobro.cobrarAlEntregar,
  });
  rev(slug, id);
  revalidatePath(`/panel/${slug}/caja`, "layout");
  if (error) return { ok: false, message: mensaje(error, "No se pudo confirmar") };
  if (reciboId) await enviarReciboPorMail(catalogo, reciboId);
  return {
    ok: true,
    message: reciboId
      ? "Venta confirmada y cobrada: se descontó el stock"
      : "Pedido confirmado: se descontó el stock",
    data: { reciboId },
  };
}

export async function avanzarPedido(
  slug: string,
  id: string,
  estado: EstadoPedido,
): Promise<ResultadoAccion> {
  await exigirEdicion(slug);
  if (!ESTADOS_PEDIDO.includes(estado)) return { ok: false, message: "Estado inválido" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("avanzar_pedido", { p_order: id, p_status: estado });
  rev(slug, id);
  if (error) return { ok: false, message: mensaje(error, "No se pudo cambiar el estado") };
  return { ok: true, message: "Estado actualizado" };
}

export async function cancelarPedido(
  slug: string,
  id: string,
  motivo: string,
): Promise<ResultadoAccion> {
  await exigirEdicion(slug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancelar_pedido", { p_order: id, p_reason: motivo });
  rev(slug, id);
  if (error) return { ok: false, message: mensaje(error, "No se pudo cancelar") };
  return { ok: true, message: "Pedido cancelado" };
}

// ------------------------------------------------------------
// Claves de canales externos (solo admin)
// ------------------------------------------------------------
export async function crearClaveCanal(
  slug: string,
  canal: CanalExterno,
  nombre: string,
): Promise<ResultadoAccion> {
  const catalogo = await exigirAdmin(slug);
  if (catalogo.kind !== "ecommerce") {
    return { ok: false, message: "Las sucursales no tienen tienda online ni canales" };
  }
  if (!CANALES_EXTERNOS.includes(canal)) return { ok: false, message: "Canal inválido" };
  const n = nombre.trim();
  if (n.length < 2 || n.length > 60) {
    return { ok: false, message: "Poné un nombre (ej: \"Tienda Aura\", \"Bot WhatsApp\")" };
  }
  const clave = `ped_${randomBytes(24).toString("base64url")}`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("channel_keys").insert({
    catalog_id: catalogo.id,
    channel: canal,
    name: n,
    key_prefix: clave.slice(0, 10),
    key_hash: hashClave(clave),
    created_by: user!.id,
    updated_by: user!.id,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/panel/${slug}/ventas/canales`);
  return { ok: true, message: "Clave creada", data: { clave } };
}

export async function activarClaveCanal(
  slug: string,
  id: string,
  activa: boolean,
): Promise<ResultadoAccion> {
  const catalogo = await exigirAdmin(slug);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("channel_keys")
    .update({ is_active: activa, updated_by: user!.id })
    .eq("id", id)
    .eq("catalog_id", catalogo.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/panel/${slug}/ventas/canales`);
  return { ok: true, message: activa ? "Clave activada" : "Clave desactivada" };
}

export async function eliminarClaveCanal(slug: string, id: string): Promise<ResultadoAccion> {
  const catalogo = await exigirAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase
    .from("channel_keys")
    .delete()
    .eq("id", id)
    .eq("catalog_id", catalogo.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/panel/${slug}/ventas/canales`);
  return { ok: true, message: "Clave eliminada" };
}

/**
 * Precio que le corresponde al cliente (o el general) por cada presentación,
 * calculado por la base (misma regla que usa al guardar la venta).
 */
export async function preciosParaCliente(
  slug: string,
  customerId: string | null,
  variantIds: string[],
): Promise<Record<string, { precio: number | null; origen: "lista" | "especial" }>> {
  await resolverCatalogo(slug);
  const supabase = await createClient();
  const ids = [...new Set(variantIds)].slice(0, 200);
  const res = await Promise.all(
    ids.map((id) =>
      supabase.rpc("precio_de_lista", { p_variant: id, p_customer: customerId }),
    ),
  );
  const out: Record<string, { precio: number | null; origen: "lista" | "especial" }> = {};
  ids.forEach((id, i) => {
    const fila = res[i].data?.[0];
    out[id] = {
      precio: fila?.price != null ? Number(fila.price) : null,
      origen: fila?.source === "especial" ? "especial" : "lista",
    };
  });
  return out;
}
