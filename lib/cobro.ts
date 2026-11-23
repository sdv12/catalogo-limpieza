import { formatearMoneda } from "@/lib/format";
import { parsearNumero } from "@/lib/validation/product";
import type { LineaPago, MetodoPago } from "@/lib/ventas";

export type LineaPagoEditable = { key: string; method: MetodoPago; amount: string; reference: string };

/**
 * Convierte lo cargado en líneas de pago para el recibo. Si se paga de más
 * en efectivo, el excedente es vuelto: se descuenta de la línea de efectivo.
 * `total` null = cobro libre (cuenta corriente: se cobra lo que se cargue).
 */
export function resolverPago(
  lineas: LineaPagoEditable[],
  total: number | null,
): { lineas: LineaPago[]; vuelto: number; error: string | null } {
  const ls = lineas
    .map((l) => ({
      method: l.method,
      amount: Math.round((parsearNumero(l.amount) ?? 0) * 100) / 100,
      reference: l.reference.trim() || null,
    }))
    .filter((l) => l.amount > 0);
  if (ls.length === 0) return { lineas: [], vuelto: 0, error: "Cargá el importe recibido" };
  const suma = Math.round(ls.reduce((a, l) => a + l.amount, 0) * 100) / 100;
  if (total == null) return { lineas: ls, vuelto: 0, error: null };

  if (suma < total) {
    return { lineas: ls, vuelto: 0, error: `Faltan ${formatearMoneda(total - suma)} para cubrir el total` };
  }
  let vuelto = Math.round((suma - total) * 100) / 100;
  if (vuelto === 0) return { lineas: ls, vuelto: 0, error: null };

  const efectivo = ls.filter((l) => l.method === "efectivo").reduce((a, l) => a + l.amount, 0);
  if (efectivo < vuelto) {
    return {
      lineas: ls,
      vuelto: 0,
      error: "Con transferencia, Mercado Pago o tarjeta no se puede cobrar de más: ajustá los importes",
    };
  }
  // descontar el vuelto de las líneas de efectivo (de la última hacia atrás)
  const out = [...ls];
  for (let i = out.length - 1; i >= 0 && vuelto > 0; i--) {
    if (out[i].method !== "efectivo") continue;
    const resta = Math.min(out[i].amount, vuelto);
    out[i] = { ...out[i], amount: Math.round((out[i].amount - resta) * 100) / 100 };
    vuelto = Math.round((vuelto - resta) * 100) / 100;
  }
  return {
    lineas: out.filter((l) => l.amount > 0),
    vuelto: Math.round((suma - total) * 100) / 100,
    error: null,
  };
}

