import { describe, it, expect } from "vitest";
import { resolverPago, type LineaPagoEditable } from "@/lib/cobro";

const l = (method: LineaPagoEditable["method"], amount: string): LineaPagoEditable => ({
  key: Math.random().toString(),
  method,
  amount,
  reference: "",
});

describe("resolverPago (cobro con vuelto)", () => {
  it("pago exacto en efectivo", () => {
    const r = resolverPago([l("efectivo", "1500")], 1500);
    expect(r.error).toBeNull();
    expect(r.vuelto).toBe(0);
    expect(r.lineas).toEqual([{ method: "efectivo", amount: 1500, reference: null }]);
  });

  it("paga de más en efectivo: el recibo queda por el total y hay vuelto", () => {
    const r = resolverPago([l("efectivo", "2000")], 1500);
    expect(r.error).toBeNull();
    expect(r.vuelto).toBe(500);
    expect(r.lineas).toEqual([{ method: "efectivo", amount: 1500, reference: null }]);
  });

  it("mixto: transferencia + efectivo con vuelto", () => {
    const r = resolverPago([l("transferencia", "1000"), l("efectivo", "1000")], 1500);
    expect(r.error).toBeNull();
    expect(r.vuelto).toBe(500);
    const total = r.lineas.reduce((a, x) => a + x.amount, 0);
    expect(total).toBe(1500);
    expect(r.lineas.find((x) => x.method === "transferencia")?.amount).toBe(1000);
  });

  it("no alcanza: error", () => {
    expect(resolverPago([l("efectivo", "1000")], 1500).error).toMatch(/Faltan/);
  });

  it("no se puede pagar de más con transferencia", () => {
    expect(resolverPago([l("transferencia", "2000")], 1500).error).toMatch(/no se puede cobrar de más/);
  });

  it("acepta coma decimal y centavos", () => {
    const r = resolverPago([l("efectivo", "1234,56")], 1234.56);
    expect(r.error).toBeNull();
    expect(r.lineas[0].amount).toBe(1234.56);
  });

  it("cobro libre (cuenta corriente): toma lo cargado", () => {
    const r = resolverPago([l("mercado_pago", "300")], null);
    expect(r.error).toBeNull();
    expect(r.lineas[0]).toEqual({ method: "mercado_pago", amount: 300, reference: null });
  });

  it("sin importe: error", () => {
    expect(resolverPago([l("efectivo", "")], null).error).toBeTruthy();
  });
});
