import { describe, it, expect, beforeEach } from "vitest";
import { crearClienteDemo } from "@/lib/demo/cliente";
import { USUARIOS_DEMO } from "@/lib/demo/datos";
import { reiniciarDemo, tabla } from "@/lib/demo/store";

/* eslint-disable @typescript-eslint/no-explicit-any */
const [, MATIAS, LUCIA, PEDRO] = USUARIOS_DEMO.map((u) => u.id);
const como = (u: string) => crearClienteDemo(u);

const cat = () => tabla("catalogs").find((c) => c.slug === "aromas")!.id as string;
const variante = (sku: string) =>
  tabla("product_variants").find((v) => v.catalog_id === cat() && v.sku === sku)! as any;
const cliente = (nombre: string) =>
  tabla("customers").find((c) => c.catalog_id === cat() && c.name === nombre)! as any;

async function venta(u: string, opts: { cliente?: string; pago?: string; items: [string, number, number?, string?][] }) {
  const r = await como(u).rpc("guardar_pedido", {
    p_catalog: cat(), p_order: null, p_customer: opts.cliente ?? null,
    p_payment: opts.pago ?? "contado", p_due_date: null, p_notes: null,
    p_items: opts.items.map(([sku, q, precio, motivo]) => ({
      variant_id: variante(sku).id, quantity: q, unit_price: precio ?? null, reason: motivo ?? null, save_special: false,
    })),
  });
  return r;
}
const pedido = (id: unknown) => tabla("orders").find((o) => o.id === id)! as any;

beforeEach(() => reiniciarDemo());

describe("modo demo — ventas y caja", () => {
  it("venta de contado: cobra con vuelto (recibo exacto), descuenta stock y se puede entregar", async () => {
    const stock0 = variante("LAV-1L").stock;
    const { data: id, error } = await venta(MATIAS, { items: [["LAV-1L", 2]] });
    expect(error).toBeNull();
    const total = pedido(id).total;
    // sin caja abierta no se puede cobrar
    const sinCaja = await como(MATIAS).rpc("confirmar_pedido", { p_order: id, p_pagos: [{ method: "efectivo", amount: total }] });
    expect(sinCaja.error?.message).toMatch(/abrí tu caja/);
    expect(pedido(id).status).toBe("nuevo"); // se volvió atrás
    expect(variante("LAV-1L").stock).toBe(stock0);

    await como(MATIAS).rpc("abrir_caja", { p_catalog: cat(), p_opening: 10000 });
    const ok = await como(MATIAS).rpc("confirmar_pedido", { p_order: id, p_pagos: [{ method: "efectivo", amount: total }] });
    expect(ok.error).toBeNull();
    expect(pedido(id).status).toBe("confirmado");
    expect(pedido(id).paid_total).toBe(total);
    expect(variante("LAV-1L").stock).toBe(stock0 - 2);
    const fin = await como(MATIAS).rpc("avanzar_pedido", { p_order: id, p_status: "entregado" });
    expect(fin.error).toBeNull();
  });

  it("contra entrega: no se entrega sin cobrar", async () => {
    const { data: id } = await venta(LUCIA, { items: [["DET-750", 1]] });
    await como(LUCIA).rpc("confirmar_pedido", { p_order: id, p_cobrar_al_entregar: true });
    expect(pedido(id).collect_on_delivery).toBe(true);
    const r = await como(LUCIA).rpc("avanzar_pedido", { p_order: id, p_status: "entregado" });
    expect(r.error?.message).toMatch(/Falta cobrar/);
    await como(LUCIA).rpc("abrir_caja", { p_catalog: cat(), p_opening: 0 });
    const c = await como(LUCIA).rpc("registrar_cobro", {
      p_catalog: cat(), p_customer: null, p_order: id, p_note: null,
      p_lines: [{ method: "transferencia", amount: pedido(id).total, reference: "123" }],
    });
    expect(c.error).toBeNull();
    expect((await como(LUCIA).rpc("avanzar_pedido", { p_order: id, p_status: "entregado" })).error).toBeNull();
  });

  it("cuenta corriente: límite de crédito solo lo supera un admin; carga la deuda", async () => {
    const pepe = cliente("Almacén Don Pepe"); // debe 95.000, límite 100.000
    const { data: id } = await venta(LUCIA, { cliente: pepe.id, pago: "cuenta_corriente", items: [["LAV-5L", 2]] });
    const emp = await como(LUCIA).rpc("confirmar_pedido", { p_order: id });
    expect(emp.error?.message).toMatch(/límite de cuenta corriente/);
    const adm = await como(MATIAS).rpc("confirmar_pedido", { p_order: id });
    expect(adm.error).toBeNull();
    expect(cliente("Almacén Don Pepe").balance).toBe(95000 + pedido(id).total);
  });

  it("precios en la venta: sin permiso no; bajo costo solo admin; con motivo obligatorio", async () => {
    const costo = variante("DES-500").cost;
    expect((await venta(LUCIA, { items: [["DES-500", 1, 3000, "acuerdo"]] })).error?.message).toMatch(/permiso de precios especiales/);
    expect((await venta(PEDRO, { items: [["DES-500", 1, 3000]] })).error?.message).toMatch(/motivo/);
    expect((await venta(PEDRO, { items: [["DES-500", 1, costo - 1, "liquidación"]] })).error?.message).toMatch(/costo/);
    expect((await venta(PEDRO, { items: [["DES-500", 1, costo + 100, "acuerdo"]] })).error).toBeNull();
    expect((await venta(MATIAS, { items: [["DES-500", 1, costo - 1, "liquidación"]] })).error).toBeNull();
  });

  it("precio especial del cliente se aplica solo", async () => {
    const total = cliente("Limpieza Total SRL");
    const { data: id } = await venta(LUCIA, { cliente: total.id, items: [["LAV-5L", 1]] });
    const it = tabla("order_items").find((i) => i.order_id === id)! as any;
    expect(it.unit_price).toBe(6100);
    expect(it.price_source).toBe("especial");
  });

  it("sin stock no confirma y no deja nada a medias", async () => {
    const { data: id } = await venta(MATIAS, { items: [["JAB-3L", 1]] }); // stock 0
    await como(MATIAS).rpc("abrir_caja", { p_catalog: cat(), p_opening: 0 });
    const r = await como(MATIAS).rpc("confirmar_pedido", { p_order: id, p_pagos: [{ method: "efectivo", amount: pedido(id).total }] });
    expect(r.error?.message).toMatch(/No hay stock suficiente/);
    expect(pedido(id).status).toBe("nuevo");
    expect(tabla("receipts")).toHaveLength(0);
  });

  it("cancelar confirmado: solo admin; devuelve stock y anula el recibo", async () => {
    const stock0 = variante("ALC-250").stock;
    const { data: id } = await venta(MATIAS, { items: [["ALC-250", 5]] });
    await como(MATIAS).rpc("abrir_caja", { p_catalog: cat(), p_opening: 0 });
    await como(MATIAS).rpc("confirmar_pedido", { p_order: id, p_pagos: [{ method: "efectivo", amount: pedido(id).total }] });
    expect((await como(LUCIA).rpc("cancelar_pedido", { p_order: id, p_reason: "error" })).error?.message).toMatch(/administradores/);
    expect((await como(MATIAS).rpc("cancelar_pedido", { p_order: id, p_reason: "pedido duplicado" })).error).toBeNull();
    expect(variante("ALC-250").stock).toBe(stock0);
    expect(tabla("receipts").every((r) => r.status === "anulado")).toBe(true);
  });

  it("cobro de cuenta corriente baja la deuda; anular el recibo la vuelve a subir (solo caja_admin)", async () => {
    const trebol = cliente("Supermercado El Trébol"); // debe 180.000
    await como(LUCIA).rpc("abrir_caja", { p_catalog: cat(), p_opening: 0 });
    const { data: rid } = await como(LUCIA).rpc("registrar_cobro", {
      p_catalog: cat(), p_customer: trebol.id, p_order: null, p_note: null,
      p_lines: [{ method: "efectivo", amount: 50000 }, { method: "mercado_pago", amount: 30000, reference: "MP-1" }],
    });
    expect(cliente("Supermercado El Trébol").balance).toBe(100000);
    expect((await como(LUCIA).rpc("anular_recibo", { p_receipt: rid, p_reason: "me equivoqué" })).error?.message).toMatch(/permiso de caja/);
    expect((await como(PEDRO).rpc("anular_recibo", { p_receipt: rid, p_reason: "cobrado dos veces" })).error).toBeNull();
    expect(cliente("Supermercado El Trébol").balance).toBe(180000);
  });

  it("arqueo: con diferencia pide nota; queda el faltante", async () => {
    const { data: sid } = await como(LUCIA).rpc("abrir_caja", { p_catalog: cat(), p_opening: 1000 });
    await como(LUCIA).rpc("registrar_movimiento_caja", { p_catalog: cat(), p_kind: "egreso", p_amount: 300, p_reason: "flete" });
    expect((await como(LUCIA).rpc("efectivo_esperado", { p_session: sid })).data).toBe(700);
    expect((await como(LUCIA).rpc("cerrar_caja", { p_session: sid, p_counted: 650, p_note: null })).error?.message).toMatch(/nota/);
    expect((await como(LUCIA).rpc("cerrar_caja", { p_session: sid, p_counted: 650, p_note: "faltó cambio" })).error).toBeNull();
    expect((tabla("cash_sessions").find((s) => s.id === sid) as any).difference).toBe(-50);
  });

  it("consultas: relaciones embebidas, filtros y conteo", async () => {
    const { data, count } = await (como(MATIAS)
      .from("orders")
      .select("id, number, customer:customers(name), order_items(sku, quantity)", { count: "exact" })
      .eq("catalog_id", cat())
      .in("status", ["nuevo"])
      .order("number") as any);
    expect(count).toBe(2);
    expect(data[0].order_items.length).toBeGreaterThan(0);
    expect(data[0].customer).toBeNull();
  });
});
