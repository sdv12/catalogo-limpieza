"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input, Select } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { formatearMoneda } from "@/lib/format";
import { parsearNumero } from "@/lib/validation/product";
import { ETIQUETA_METODO_PAGO, METODOS_PAGO, type MetodoPago } from "@/lib/ventas";
import { resolverPago, type LineaPagoEditable } from "@/lib/cobro";

export { resolverPago, type LineaPagoEditable };

let seq = 0;
export const nuevaLineaPago = (method: MetodoPago = "efectivo", amount = ""): LineaPagoEditable => ({
  key: `p${++seq}`,
  method,
  amount,
  reference: "",
});

export function MediosPago({
  lineas,
  onChange,
  total,
}: {
  lineas: LineaPagoEditable[];
  onChange: (ls: LineaPagoEditable[]) => void;
  /** Total a cubrir (null = cobro libre). */
  total: number | null;
}) {
  const set = (key: string, cambios: Partial<LineaPagoEditable>) =>
    onChange(lineas.map((l) => (l.key === key ? { ...l, ...cambios } : l)));
  const r = resolverPago(lineas, total);
  const suma = lineas.reduce((a, l) => a + (parsearNumero(l.amount) ?? 0), 0);
  const restante = total != null ? Math.max(0, Math.round((total - suma) * 100) / 100) : 0;

  return (
    <div className="space-y-2">
      {lineas.map((l) => (
        <div key={l.key} className="flex flex-wrap gap-2">
          <Select
            value={l.method}
            onChange={(e) => set(l.key, { method: e.target.value as MetodoPago })}
            className="w-44"
            aria-label="Medio de pago"
          >
            {METODOS_PAGO.map((m) => (
              <option key={m} value={m}>
                {ETIQUETA_METODO_PAGO[m]}
              </option>
            ))}
          </Select>
          <Input
            inputMode="decimal"
            value={l.amount}
            onChange={(e) => set(l.key, { amount: e.target.value })}
            placeholder="Importe"
            className="w-32"
            aria-label="Importe"
          />
          {l.method !== "efectivo" && (
            <Input
              value={l.reference}
              maxLength={100}
              onChange={(e) => set(l.key, { reference: e.target.value })}
              placeholder="N° de operación (opcional)"
              className="min-w-40 flex-1"
            />
          )}
          {lineas.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(lineas.filter((x) => x.key !== l.key))}
              className="rounded-comp-sm p-2 text-texto-sec hover:bg-error-suave hover:text-error"
              aria-label="Quitar medio de pago"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ))}
      {lineas.length < 10 && (
        <button
          type="button"
          onClick={() =>
            onChange([...lineas, nuevaLineaPago("transferencia", restante > 0 ? String(restante) : "")])
          }
          className="inline-flex items-center gap-1 text-xs text-primario hover:underline"
        >
          <Plus size={13} />
          Agregar otro medio de pago
        </button>
      )}
      <div className="flex flex-wrap gap-x-4 text-sm">
        <span className="text-texto-sec">
          Recibido <span className="font-medium tabular-nums text-texto">{formatearMoneda(suma)}</span>
        </span>
        {total != null && restante > 0 && (
          <span className="text-alerta">Falta {formatearMoneda(restante)}</span>
        )}
        {r.vuelto > 0 && (
          <span className="font-medium text-exito">Vuelto {formatearMoneda(r.vuelto)}</span>
        )}
      </div>
      {r.error && suma > 0 && (
        <p className={cn("text-xs", r.error ? "text-error" : "")}>{r.error}</p>
      )}
    </div>
  );
}
