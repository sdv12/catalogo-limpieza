/**
 * Funciones de la base portadas al modo demo, con las mismas reglas que las
 * migraciones (precios, ventas, caja, stock). Si cambia una función SQL,
 * actualizar acá también.
 */
import { tabla as tablaBase, recalcularCuenta } from "@/lib/demo/store";
import { auditar, type Actor } from "@/lib/demo/auditoria";

type Fila = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const tabla = (n: string) => tablaBase(n) as Fila[];

class ErrorDemo extends Error {}
const falla = (m: string): never => {
  throw new ErrorDemo(m);
};
const r2 = (n: number) => Math.round(n * 100) / 100;
const ahora = () => new Date().toISOString();
const hoyAr = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Cordoba" });
const sumarDias = (fecha: string, d: number) => {
  const f = new Date(`${fecha}T12:00:00`);
  f.setDate(f.getDate() + d);
  return f.toISOString().slice(0, 10);
};

// ------------------------------------------------------------
// Permisos (is_catalog_admin / can_edit_catalog / tiene_permiso)
// ------------------------------------------------------------
function esSuper(a: Actor) {
  return !!tabla("profiles").find((p) => p.id === a.uid)?.is_superadmin;
}
function miembro(a: Actor, cat: unknown): Fila | undefined {
  return tabla("catalog_members").find((m) => m.catalog_id === cat && m.user_id === a.uid);
}
const esAdmin = (a: Actor, cat: unknown) => esSuper(a) || miembro(a, cat)?.role === "admin";
const puedeEditar = (a: Actor, cat: unknown) =>
  esAdmin(a, cat) || miembro(a, cat)?.role === "empleado";
const tienePermiso = (a: Actor, cat: unknown, p: string) =>
  esAdmin(a, cat) ||
  (miembro(a, cat)?.role === "empleado" && (miembro(a, cat)!.permissions as string[]).includes(p));

// ------------------------------------------------------------
// helpers de escritura con auditoría
// ------------------------------------------------------------
function insertar(a: Actor, t: string, fila: Fila): Fila {
  const f = { id: crypto.randomUUID(), created_at: ahora(), updated_at: ahora(), ...fila };
  tabla(t).push(f);
  auditar(a, t, null, f);
  return f;
}
function actualizar(a: Actor, t: string, f: Fila, cambios: Fila, accion?: string, motivo?: string) {
  const antes = { ...f };
  Object.assign(f, cambios, { updated_at: ahora() });
  auditar(a, t, antes, f, accion, motivo);
}
const siguienteNumero = (t: string, cat: unknown) =>
  tabla(t).filter((x) => x.catalog_id === cat).reduce((m, x) => Math.max(m, Number(x.number)), 0) + 1;

// ------------------------------------------------------------
// Precios
// ------------------------------------------------------------
function precioDeLista(variantId: unknown, customerId: unknown): { price: number | null; source: string } {
  const v = tabla("product_variants").find((x) => x.id === variantId);
  if (!v) return { price: null, source: "lista" };
  let tier: unknown = null;
  if (customerId) {
    const hoy = hoyAr();
    const esp = tabla("customer_prices").find(
      (c) => c.customer_id === customerId && c.variant_id === variantId && (c.ends_on == null || c.ends_on >= hoy),
    );
    if (esp) return { price: Number(esp.price), source: "especial" };
    tier = tabla("customers").find((c) => c.id === customerId)?.price_tier_id ?? null;
  }
  const vp = tabla("variant_prices");
  let precio = tier ? vp.find((p) => p.variant_id === variantId && p.price_tier_id === tier)?.price : undefined;
  if (precio == null) {
    const def = tabla("price_tiers").find((t) => t.catalog_id === v.catalog_id && t.is_default);
    precio = vp.find((p) => p.variant_id === variantId && p.price_tier_id === def?.id)?.price;
  }
  return { price: precio == null ? null : Number(precio), source: "lista" };
}

// ------------------------------------------------------------
// Ventas
// ------------------------------------------------------------
function cargarItems(a: Actor, order: Fila, customerId: unknown, items: Fila[], externo: boolean): number {
  if (!Array.isArray(items) || items.length === 0) falla("El pedido no tiene productos");
  if (items.length > 200) falla("Máximo 200 renglones por pedido");
  let total = 0;
  items.forEach((it, i) => {
    const pos = i + 1;
    const v = tabla("product_variants").find(
      (x) => x.id === it.variant_id && x.catalog_id === order.catalog_id && !x.is_deleted,
    );
    const p = v && tabla("products").find((x) => x.id === v.product_id && !x.is_deleted);
    if (!v || !p) falla(`Renglón ${pos}: el producto no existe en este catálogo`);
    const qty = Number(it.quantity);
    if (!qty || qty <= 0 || qty > 100000) falla(`Renglón ${pos} (${p!.name}): cantidad inválida`);
    const lista = precioDeLista(v!.id, customerId);
    let unit = externo || it.unit_price == null ? null : Number(it.unit_price);
    let reason = String(it.reason ?? "").trim() || null;
    let especial = !externo && !!it.save_special;
    if (unit == null) {
      if (lista.price == null) falla(`Renglón ${pos} (${p!.name} ${v!.name}): no tiene precio cargado`);
      unit = lista.price!;
    }
    unit = r2(unit);
    if (unit < 0) falla(`Renglón ${pos}: el precio no puede ser negativo`);
    const manual = lista.price == null || unit !== r2(lista.price);
    let source = lista.source;
    if (manual) {
      if (!tienePermiso(a, order.catalog_id, "precios_especiales"))
        falla("Cambiar el precio en una venta requiere el permiso de precios especiales");
      if (!reason || reason.length < 3) falla(`Renglón ${pos} (${p!.name}): escribí el motivo del cambio de precio`);
      if (v!.cost != null && Number(v!.cost) > 0 && unit < Number(v!.cost) && !esAdmin(a, order.catalog_id))
        falla(`Renglón ${pos} (${p!.name}): por debajo del costo solo lo puede vender un administrador`);
      source = "manual";
    } else {
      reason = null;
      especial = false;
    }
    if (especial && !customerId) falla("Para guardar un precio fijo hay que elegir un cliente");
    insertar(a, "order_items", {
      catalog_id: order.catalog_id, order_id: order.id, variant_id: v!.id, position: pos,
      product_name: p!.name, variant_name: v!.name, sku: v!.sku, quantity: qty,
      list_price: lista.price, unit_price: unit, price_source: source, price_reason: reason,
      save_special: especial, unit_cost: v!.cost, line_total: r2(qty * unit),
    });
    total += r2(qty * unit);
  });
  return r2(total);
}

function guardarPedido(a: Actor, x: Fila) {
  const cat = x.p_catalog;
  if (!a.uid || !puedeEditar(a, cat)) falla("Sin permiso para cargar ventas en este catálogo");
  if (!["contado", "cuenta_corriente"].includes(x.p_payment)) falla("Condición de pago inválida");
  if (x.p_payment === "cuenta_corriente" && !x.p_customer) falla("Una venta a cuenta corriente necesita un cliente");
  if (x.p_customer && !tabla("customers").some((c) => c.id === x.p_customer && c.catalog_id === cat && !c.is_deleted))
    falla("El cliente no existe en este catálogo");
  const notas = String(x.p_notes ?? "").trim() || null;
  const due = x.p_payment === "cuenta_corriente" ? x.p_due_date : null;
  let order: Fila;
  if (!x.p_order) {
    order = insertar(a, "orders", {
      catalog_id: cat, number: siguienteNumero("orders", cat), channel: "panel", channel_name: null,
      external_ref: null, status: "nuevo", customer_id: x.p_customer, contact_name: null,
      contact_phone: null, contact_email: null, delivery_address: null, notes: notas,
      payment_terms: x.p_payment, due_date: due, total: 0, paid_total: 0, collect_on_delivery: false,
      confirmed_at: null, confirmed_by: null, delivered_at: null, delivered_by: null,
      cancelled_at: null, cancelled_by: null, cancel_reason: null, created_by: a.uid, updated_by: a.uid,
    });
  } else {
    order = tabla("orders").find((o) => o.id === x.p_order && o.catalog_id === cat) ?? falla("El pedido no existe");
    if (order.status !== "nuevo") falla("Solo se puede editar un pedido en estado Nuevo");
    actualizar(a, "orders", order, { customer_id: x.p_customer, payment_terms: x.p_payment, due_date: due, notes: notas, updated_by: a.uid });
    const its = tabla("order_items");
    for (const it of its.filter((i) => i.order_id === order.id)) {
      its.splice(its.indexOf(it), 1);
      auditar(a, "order_items", it, null);
    }
  }
  const total = cargarItems(a, order, x.p_customer, x.p_items, false);
  order.total = total;
  return order.id;
}

function moverStock(a: Actor, order: Fila, signo: 1 | -1, motivo: "venta" | "ajuste", nota: string) {
  const porVariante = new Map<unknown, number>();
  for (const it of tabla("order_items").filter((i) => i.order_id === order.id)) {
    porVariante.set(it.variant_id, (porVariante.get(it.variant_id) ?? 0) + Number(it.quantity));
  }
  for (const [vid, qty] of porVariante) {
    const v = tabla("product_variants").find((x) => x.id === vid)!;
    const prev = Number(v.stock);
    actualizar(a, "product_variants", v, { stock: prev + signo * qty, updated_by: a.uid }, "stock_adjust", motivo);
    tabla("stock_movements").push({
      id: crypto.randomUUID(), catalog_id: order.catalog_id, variant_id: vid, delta: signo * qty,
      reason: motivo, note: nota, previous_stock: prev, new_stock: prev + signo * qty,
      batch_id: null, created_at: ahora(), created_by: a.uid, order_id: order.id,
    });
  }
}

function cajaAbierta(a: Actor, cat: unknown): Fila {
  return (
    tabla("cash_sessions").find((s) => s.catalog_id === cat && s.user_id === a.uid && s.status === "abierta") ??
    falla("Primero abrí tu caja (sección Caja)")
  );
}

function emitirRecibo(a: Actor, cat: unknown, customerId: unknown, orderId: unknown, lineas: Fila[], nota: unknown): Fila {
  const caja = cajaAbierta(a, cat);
  if (!Array.isArray(lineas) || lineas.length === 0) falla("Indicá al menos un medio de pago");
  if (lineas.length > 10) falla("Máximo 10 medios de pago por recibo");
  let total = 0;
  for (const l of lineas) {
    const m = r2(Number(l.amount));
    if (!m || m <= 0) falla("Importe inválido en el medio de pago");
    if (!["efectivo", "transferencia", "mercado_pago", "debito", "credito"].includes(l.method)) falla("Medio de pago inválido");
    total += m;
  }
  const rec = insertar(a, "receipts", {
    catalog_id: cat, number: siguienteNumero("receipts", cat), session_id: caja.id,
    customer_id: customerId ?? null, order_id: orderId ?? null, total: r2(total),
    note: String(nota ?? "").trim() || null, status: "valido", voided_at: null, voided_by: null,
    void_reason: null, emailed_at: null, created_by: a.uid,
  });
  for (const l of lineas) {
    tabla("receipt_lines").push({
      id: crypto.randomUUID(), catalog_id: cat, receipt_id: rec.id, method: l.method,
      amount: r2(Number(l.amount)), reference: String(l.reference ?? "").trim().slice(0, 100) || null,
    });
  }
  return rec;
}

function confirmarPedido(a: Actor, x: Fila) {
  const o = tabla("orders").find((r) => r.id === x.p_order) ?? falla("El pedido no existe");
  if (!a.uid || !puedeEditar(a, o.catalog_id)) falla("Sin permiso para confirmar ventas en este catálogo");
  if (o.status !== "nuevo") falla("El pedido ya no está en estado Nuevo");
  const items = tabla("order_items").filter((i) => i.order_id === o.id);
  if (items.length === 0) falla("El pedido no tiene productos");
  const alEntregar = !!x.p_cobrar_al_entregar;
  const cobraAhora = o.payment_terms === "contado" && Number(o.total) > 0 && !alEntregar;
  if (cobraAhora) {
    if (!Array.isArray(x.p_pagos) || x.p_pagos.length === 0) falla('Indicá cómo paga (o marcá "cobrar al entregar")');
    cajaAbierta(a, o.catalog_id);
    const suma = r2(x.p_pagos.reduce((s: number, l: Fila) => s + Number(l.amount), 0));
    if (suma !== r2(Number(o.total))) falla(`Lo cobrado (${suma}) no coincide con el total del pedido (${o.total})`);
  }
  if (o.payment_terms === "cuenta_corriente") {
    const c = tabla("customers").find((r) => r.id === o.customer_id)!;
    if (Number(c.credit_limit) > 0 && Number(c.balance) + Number(o.total) > Number(c.credit_limit) && !esAdmin(a, o.catalog_id))
      falla(`Con esta venta el cliente supera su límite de cuenta corriente (${c.credit_limit}): solo un administrador puede confirmarla`);
  }
  const faltas: string[] = [];
  const porVariante = new Map<unknown, { qty: number; it: Fila }>();
  for (const it of items) {
    const e = porVariante.get(it.variant_id);
    porVariante.set(it.variant_id, { qty: (e?.qty ?? 0) + Number(it.quantity), it });
  }
  for (const [vid, { qty, it }] of porVariante) {
    const stock = Number(tabla("product_variants").find((v) => v.id === vid)!.stock);
    if (stock < qty) faltas.push(`- ${it.product_name} ${it.variant_name}: hay ${stock}, pide ${qty}`);
  }
  if (faltas.length) falla(`No hay stock suficiente:\n${faltas.join("\n")}`);

  moverStock(a, o, -1, "venta", `Pedido #${o.number}`);
  if (o.payment_terms === "cuenta_corriente" && Number(o.total) > 0) {
    insertar(a, "customer_transactions", {
      catalog_id: o.catalog_id, customer_id: o.customer_id, kind: "cargo", amount: o.total,
      due_date: o.due_date ?? sumarDias(hoyAr(), 30), note: `Pedido #${o.number}`, is_deleted: false,
      order_id: o.id, receipt_id: null, created_by: a.uid, updated_by: a.uid,
    });
    recalcularCuenta(o.customer_id);
  }
  for (const it of items.filter((i) => i.save_special && o.customer_id)) {
    const cp = tabla("customer_prices").find((c) => c.customer_id === o.customer_id && c.variant_id === it.variant_id);
    const datos = { price: it.unit_price, reason: `${it.price_reason} (pedido #${o.number})`, ends_on: null, updated_by: a.uid };
    if (cp) actualizar(a, "customer_prices", cp, datos);
    else insertar(a, "customer_prices", { catalog_id: o.catalog_id, customer_id: o.customer_id, variant_id: it.variant_id, created_by: a.uid, ...datos });
  }
  actualizar(a, "orders", o, {
    status: "confirmado", confirmed_at: ahora(), confirmed_by: a.uid, updated_by: a.uid,
    collect_on_delivery: o.payment_terms === "contado" && alEntregar,
  });
  if (cobraAhora) {
    const rec = emitirRecibo(a, o.catalog_id, o.customer_id, o.id, x.p_pagos, null);
    o.paid_total = rec.total;
    return rec.id;
  }
  return null;
}

function avanzarPedido(a: Actor, x: Fila) {
  const orden = ["confirmado", "preparando", "en_reparto", "entregado"];
  const o = tabla("orders").find((r) => r.id === x.p_order) ?? falla("El pedido no existe");
  if (!a.uid || !puedeEditar(a, o.catalog_id)) falla("Sin permiso en este catálogo");
  if (!orden.includes(x.p_status) || !orden.includes(o.status)) falla("Cambio de estado inválido");
  if (orden.indexOf(x.p_status) <= orden.indexOf(o.status)) falla("El pedido solo puede avanzar de estado");
  if (x.p_status === "entregado" && o.payment_terms === "contado" && Number(o.paid_total) < Number(o.total))
    falla(`Falta cobrar ${r2(o.total - o.paid_total)} de este pedido: registrá el cobro antes de marcarlo Entregado`);
  const cambios: Fila = { status: x.p_status, updated_by: a.uid };
  if (x.p_status === "entregado") Object.assign(cambios, { delivered_at: ahora(), delivered_by: a.uid });
  actualizar(a, "orders", o, cambios);
  return null;
}

function cancelarPedido(a: Actor, x: Fila) {
  const o = tabla("orders").find((r) => r.id === x.p_order) ?? falla("El pedido no existe");
  if (!a.uid || !puedeEditar(a, o.catalog_id)) falla("Sin permiso en este catálogo");
  const motivo = String(x.p_reason ?? "").trim();
  if (motivo.length < 3) falla("Escribí el motivo de la cancelación");
  if (["cancelado", "entregado"].includes(o.status)) falla(`Un pedido ${o.status} no se puede cancelar`);
  if (o.status !== "nuevo") {
    if (!esAdmin(a, o.catalog_id)) falla("Cancelar un pedido ya confirmado es solo para administradores");
    moverStock(a, o, 1, "ajuste", `Cancelación pedido #${o.number}`);
    for (const m of tabla("customer_transactions").filter((t) => t.order_id === o.id && !t.is_deleted)) {
      actualizar(a, "customer_transactions", m, { is_deleted: true, deleted_at: ahora(), deleted_by: a.uid });
      recalcularCuenta(m.customer_id);
    }
    for (const r of tabla("receipts").filter((t) => t.order_id === o.id && t.status === "valido")) {
      actualizar(a, "receipts", r, { status: "anulado", voided_at: ahora(), voided_by: a.uid, void_reason: `Cancelación del pedido: ${motivo}` });
    }
    o.paid_total = 0;
  }
  actualizar(a, "orders", o, { status: "cancelado", cancelled_at: ahora(), cancelled_by: a.uid, cancel_reason: motivo, updated_by: a.uid });
  return null;
}

// ------------------------------------------------------------
// Caja
// ------------------------------------------------------------
function abrirCaja(a: Actor, x: Fila) {
  if (!a.uid || !puedeEditar(a, x.p_catalog)) falla("Sin permiso para usar la caja en este catálogo");
  if (x.p_opening == null || Number(x.p_opening) < 0) falla("El efectivo inicial no puede ser negativo");
  if (tabla("cash_sessions").some((s) => s.catalog_id === x.p_catalog && s.user_id === a.uid && s.status === "abierta"))
    falla("Ya tenés una caja abierta");
  return insertar(a, "cash_sessions", {
    catalog_id: x.p_catalog, user_id: a.uid, status: "abierta", opened_at: ahora(),
    opening_amount: r2(Number(x.p_opening)), closed_at: null, closed_by: null, expected_cash: null,
    counted_cash: null, difference: null, closing_note: null,
  }).id;
}

function registrarCobro(a: Actor, x: Fila) {
  const cat = x.p_catalog;
  if (!a.uid || !puedeEditar(a, cat)) falla("Sin permiso para cobrar en este catálogo");
  if (x.p_order) {
    const o = tabla("orders").find((r) => r.id === x.p_order && r.catalog_id === cat) ?? falla("El pedido no existe");
    if (o.payment_terms !== "contado") falla("Un pedido a cuenta corriente se cobra desde la cuenta del cliente");
    if (["nuevo", "cancelado"].includes(o.status)) falla("Solo se cobra un pedido confirmado");
    const suma = r2((x.p_lines as Fila[]).reduce((s, l) => s + Number(l.amount), 0));
    if (suma > r2(o.total - o.paid_total))
      falla(`El cobro (${suma}) supera lo que falta pagar del pedido (${r2(o.total - o.paid_total)})`);
    const rec = emitirRecibo(a, cat, o.customer_id, o.id, x.p_lines, x.p_note);
    actualizar(a, "orders", o, { paid_total: r2(Number(o.paid_total) + Number(rec.total)), updated_by: a.uid });
    return rec.id;
  }
  if (!x.p_customer) falla("Elegí el cliente que paga");
  if (!tabla("customers").some((c) => c.id === x.p_customer && c.catalog_id === cat && !c.is_deleted))
    falla("El cliente no existe en este catálogo");
  const rec = emitirRecibo(a, cat, x.p_customer, null, x.p_lines, x.p_note);
  insertar(a, "customer_transactions", {
    catalog_id: cat, customer_id: x.p_customer, kind: "pago", amount: -rec.total, due_date: null,
    note: `Recibo #${rec.number}`, is_deleted: false, order_id: null, receipt_id: rec.id,
    created_by: a.uid, updated_by: a.uid,
  });
  recalcularCuenta(x.p_customer);
  return rec.id;
}

function movimientoCaja(a: Actor, x: Fila) {
  if (!a.uid || !puedeEditar(a, x.p_catalog)) falla("Sin permiso en este catálogo");
  const caja = cajaAbierta(a, x.p_catalog);
  if (!["ingreso", "egreso"].includes(x.p_kind)) falla("Tipo de movimiento inválido");
  if (!(Number(x.p_amount) > 0)) falla("El importe tiene que ser mayor a 0");
  if (String(x.p_reason ?? "").trim().length < 3) falla("Escribí el motivo");
  insertar(a, "cash_movements", {
    catalog_id: x.p_catalog, session_id: caja.id, kind: x.p_kind, amount: r2(Number(x.p_amount)),
    reason: String(x.p_reason).trim(), created_by: a.uid,
  });
  return null;
}

function efectivoEsperado(sessionId: unknown): number {
  const s = tabla("cash_sessions").find((c) => c.id === sessionId);
  if (!s) return 0;
  const recibos = new Set(tabla("receipts").filter((r) => r.session_id === s.id && r.status === "valido").map((r) => r.id));
  const efectivo = tabla("receipt_lines").filter((l) => recibos.has(l.receipt_id) && l.method === "efectivo").reduce((t, l) => t + Number(l.amount), 0);
  const movs = tabla("cash_movements").filter((m) => m.session_id === s.id);
  const ing = movs.filter((m) => m.kind === "ingreso").reduce((t, m) => t + Number(m.amount), 0);
  const egr = movs.filter((m) => m.kind === "egreso").reduce((t, m) => t + Number(m.amount), 0);
  return r2(Number(s.opening_amount) + efectivo + ing - egr);
}

function cerrarCaja(a: Actor, x: Fila) {
  const s = tabla("cash_sessions").find((c) => c.id === x.p_session) ?? falla("La caja no existe");
  if (!a.uid || !(s.user_id === a.uid || tienePermiso(a, s.catalog_id, "caja_admin"))) falla("Sin permiso para cerrar esta caja");
  if (s.status !== "abierta") falla("La caja ya está cerrada");
  if (x.p_counted == null || Number(x.p_counted) < 0) falla("Indicá el efectivo contado");
  const esperado = efectivoEsperado(s.id);
  const contado = r2(Number(x.p_counted));
  if (contado !== esperado && String(x.p_note ?? "").trim().length < 3)
    falla("Hay diferencia con lo esperado: escribí una nota explicando el motivo");
  actualizar(a, "cash_sessions", s, {
    status: "cerrada", closed_at: ahora(), closed_by: a.uid, expected_cash: esperado,
    counted_cash: contado, difference: r2(contado - esperado), closing_note: String(x.p_note ?? "").trim() || null,
  });
  return null;
}

function anularRecibo(a: Actor, x: Fila) {
  const r = tabla("receipts").find((c) => c.id === x.p_receipt) ?? falla("El recibo no existe");
  if (!a.uid || !tienePermiso(a, r.catalog_id, "caja_admin")) falla("Anular un recibo requiere el permiso de caja");
  if (r.status === "anulado") falla("El recibo ya está anulado");
  if (String(x.p_reason ?? "").trim().length < 3) falla("Escribí el motivo de la anulación");
  for (const m of tabla("customer_transactions").filter((t) => t.receipt_id === r.id && !t.is_deleted)) {
    actualizar(a, "customer_transactions", m, { is_deleted: true, deleted_at: ahora(), deleted_by: a.uid });
    recalcularCuenta(m.customer_id);
  }
  if (r.order_id) {
    const o = tabla("orders").find((q) => q.id === r.order_id)!;
    actualizar(a, "orders", o, { paid_total: Math.max(0, r2(o.paid_total - r.total)), updated_by: a.uid });
  }
  actualizar(a, "receipts", r, { status: "anulado", voided_at: ahora(), voided_by: a.uid, void_reason: String(x.p_reason).trim() });
  return null;
}

// ------------------------------------------------------------
// Catálogo: listado, tablero, stock
// ------------------------------------------------------------
function searchProducts(x: Fila) {
  const cat = x.p_catalog_id;
  const vars = tabla("product_variants");
  const precios = tabla("variant_prices");
  const q = String(x.p_q ?? "").trim().toLowerCase();
  let ps = tabla("products").filter((p) => p.catalog_id === cat && (x.p_include_deleted || !p.is_deleted));
  if (x.p_status) ps = ps.filter((p) => p.status === x.p_status);
  if (x.p_category_id) ps = ps.filter((p) => tabla("product_categories").some((pc) => pc.product_id === p.id && pc.category_id === x.p_category_id));
  if (x.p_brand) ps = ps.filter((p) => p.brand === x.p_brand);
  if (x.p_supplier_id) ps = ps.filter((p) => tabla("product_suppliers").some((s) => s.product_id === p.id && s.supplier_id === x.p_supplier_id));
  const filas = ps.map((p) => {
    const vs = vars.filter((v) => v.product_id === p.id && !v.is_deleted);
    const ps2 = precios.filter((pr) => vs.some((v) => v.id === pr.variant_id)).map((pr) => Number(pr.price));
    const costos = vs.map((v) => v.cost).filter((c) => c != null).map(Number);
    const prov = tabla("product_suppliers").find((s) => s.product_id === p.id && s.is_primary);
    return {
      id: p.id, name: p.name, base_sku: p.base_sku, brand: p.brand, status: p.status, is_deleted: p.is_deleted,
      updated_at: p.updated_at,
      category_name: tabla("categories").find((c) => c.id === p.primary_category_id)?.name ?? null,
      variant_count: vs.length,
      total_stock: vs.reduce((t, v) => t + Number(v.stock), 0),
      low_stock: vs.some((v) => Number(v.stock) <= Number(v.min_stock)),
      min_price: ps2.length ? Math.min(...ps2) : null,
      max_price: ps2.length ? Math.max(...ps2) : null,
      min_cost: costos.length ? Math.min(...costos) : null,
      supplier_name: prov ? tabla("suppliers").find((s) => s.id === prov.supplier_id)?.name ?? null : null,
      primary_image: tabla("product_images").find((i) => i.product_id === p.id && i.is_primary)?.storage_path ?? null,
      _skus: vs.map((v) => String(v.sku).toLowerCase()).join(" "),
    };
  });
  let out = filas.filter((f) => !q || [f.name, f.base_sku, f.brand, f._skus].some((s) => String(s ?? "").toLowerCase().includes(q)));
  if (x.p_stock === "low") out = out.filter((f) => f.low_stock);
  if (x.p_stock === "ok") out = out.filter((f) => !f.low_stock);
  const sort = String(x.p_sort ?? "updated_at");
  const dir = x.p_dir === "asc" ? 1 : -1;
  out.sort((a, b) => String((a as Fila)[sort] ?? "").localeCompare(String((b as Fila)[sort] ?? "")) * dir);
  const total = out.length;
  return out
    .slice(Number(x.p_offset ?? 0), Number(x.p_offset ?? 0) + Number(x.p_limit ?? 50))
    .map(({ _skus, ...f }) => ({ ...f, total_count: total })); // eslint-disable-line @typescript-eslint/no-unused-vars
}

function catalogStats(x: Fila) {
  const cat = x.p_catalog_id;
  const ps = tabla("products").filter((p) => p.catalog_id === cat && !p.is_deleted);
  const vs = tabla("product_variants").filter((v) => v.catalog_id === cat && !v.is_deleted);
  const cs = tabla("customers").filter((c) => c.catalog_id === cat && !c.is_deleted);
  const hoy = hoyAr();
  return {
    productos_total: ps.length,
    productos_activos: ps.filter((p) => p.status === "active").length,
    productos_inactivos: ps.filter((p) => p.status === "inactive").length,
    variantes_total: vs.length,
    stock_bajo: vs.filter((v) => Number(v.stock) <= Number(v.min_stock)).length,
    sin_stock: vs.filter((v) => Number(v.stock) <= 0).length,
    unidades_stock: vs.reduce((t, v) => t + Number(v.stock), 0),
    inventario_costo: vs.reduce((t, v) => t + Number(v.stock) * Number(v.cost ?? 0), 0),
    categorias: tabla("categories").filter((c) => c.catalog_id === cat).length,
    clientes: cs.length,
    proveedores: tabla("suppliers").filter((s) => s.catalog_id === cat && !s.is_deleted).length,
    clientes_con_deuda: cs.filter((c) => Number(c.balance) > 0).length,
    clientes_en_mora: cs.filter((c) => Number(c.balance) > 0 && c.next_due_date && c.next_due_date < hoy).length,
    deuda_total: cs.reduce((t, c) => t + Math.max(0, Number(c.balance)), 0),
  };
}

function adjustStock(a: Actor, x: Fila) {
  const v = tabla("product_variants").find((r) => r.id === x.p_variant_id) ?? falla("La variante no existe");
  if (!a.uid || !puedeEditar(a, v.catalog_id)) falla("Sin permiso de edición en este catálogo");
  const prev = Number(v.stock);
  actualizar(a, "product_variants", v, { stock: prev + Number(x.p_delta), updated_by: a.uid }, "stock_adjust", x.p_reason);
  tabla("stock_movements").push({
    id: crypto.randomUUID(), catalog_id: v.catalog_id, variant_id: v.id, delta: Number(x.p_delta),
    reason: x.p_reason, note: x.p_note ?? null, previous_stock: prev, new_stock: v.stock,
    batch_id: null, created_at: ahora(), created_by: a.uid, order_id: null,
  });
  return v;
}

// ------------------------------------------------------------
export function ejecutarRpc(nombre: string, x: Fila, a: Actor): unknown {
  switch (nombre) {
    case "precio_de_lista": return [precioDeLista(x.p_variant, x.p_customer)];
    case "guardar_pedido": return guardarPedido(a, x);
    case "confirmar_pedido": return confirmarPedido(a, x);
    case "avanzar_pedido": return avanzarPedido(a, x);
    case "cancelar_pedido": return cancelarPedido(a, x);
    case "abrir_caja": return abrirCaja(a, x);
    case "registrar_cobro": return registrarCobro(a, x);
    case "registrar_movimiento_caja": return movimientoCaja(a, x);
    case "efectivo_esperado": return efectivoEsperado(x.p_session);
    case "cerrar_caja": return cerrarCaja(a, x);
    case "anular_recibo": return anularRecibo(a, x);
    case "marcar_recibo_enviado": return null;
    case "search_products": return searchProducts(x);
    case "catalog_stats": return catalogStats(x);
    case "catalog_actors": {
      const vistos = new Map<string, string | null>();
      for (const e of tabla("audit_log").filter((l) => l.catalog_id === x.p_catalog_id)) vistos.set(e.actor_id, e.actor_email);
      return [...vistos].map(([actor_id, actor_email]) => ({ actor_id, actor_email }));
    }
    case "adjust_stock": return adjustStock(a, x);
    case "customers_por_cobrar": return [];
    case "supplier_products": return [];
  }
  return falla(`"${nombre}" no está disponible en el modo demo`);
}
