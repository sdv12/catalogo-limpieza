"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { notificar } from "@/lib/ui";
import { formatearMoneda, formatearFecha } from "@/lib/format";
import { parsearNumero } from "@/lib/validation/ledger";
import {
  TIPOS_MOVIMIENTO_CC,
  ETIQUETA_MOVIMIENTO_CC,
  SIGNO_MOVIMIENTO_CC,
  type TipoMovimientoCC,
} from "@/lib/constants";
import {
  agregarMovimiento,
  eliminarMovimiento,
} from "@/app/panel/[catalogo]/clientes/actions";

export type MovimientoFila = {
  id: string;
  kind: TipoMovimientoCC;
  amount: number;
  due_date: string | null;
  note: string | null;
  created_at: string;
};

export function CustomerLedger({
  slug,
  customerId,
  balance,
  nextDueDate,
  movimientos,
  puedeCargar,
  puedeCorregir,
}: {
  slug: string;
  customerId: string;
  balance: number;
  nextDueDate: string | null;
  movimientos: MovimientoFila[];
  puedeCargar: boolean;
  puedeCorregir: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [kind, setKind] = useState<TipoMovimientoCC>("cargo");
  const [monto, setMonto] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aBorrar, setABorrar] = useState<string | null>(null);

  const signo = SIGNO_MOVIMIENTO_CC[kind];
  const llevaVencimiento = kind === "cargo" || kind === "nota_debito";

  async function guardar() {
    const abs = Math.abs(parsearNumero(monto) ?? 0);
    if (abs <= 0) return notificar({ ok: false, message: "Ingresá un importe" });
    const amount = signo == null ? abs : abs * signo;
    setGuardando(true);
    const r = await agregarMovimiento(slug, customerId, {
      kind,
      amount,
      due_date: llevaVencimiento && vencimiento ? vencimiento : null,
      note: nota || null,
    });
    setGuardando(false);
    if (notificar(r)) {
      setMonto("");
      setVencimiento("");
      setNota("");
      setAbierto(false);
      router.refresh();
    }
  }

  async function borrar() {
    if (!aBorrar) return;
    const r = await eliminarMovimiento(slug, customerId, aBorrar);
    setABorrar(null);
    if (notificar(r)) router.refresh();
  }

  const vencida = nextDueDate != null && new Date(nextDueDate) < new Date(new Date().toDateString());

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>Cuenta corriente</CardTitle>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p
              className={`text-lg font-semibold tabular-nums ${
                balance > 0 ? "text-error" : "text-texto"
              }`}
            >
              {formatearMoneda(balance)}
            </p>
            {nextDueDate && (
              <p className={`text-xs ${vencida ? "text-error" : "text-texto-tenue"}`}>
                {vencida ? "Vencido" : "Vence"} {formatearFecha(nextDueDate)}
              </p>
            )}
          </div>
          {puedeCargar && (
            <Button tamano="sm" onClick={() => setAbierto((v) => !v)}>
              <Plus size={14} />
              Movimiento
            </Button>
          )}
        </div>
      </CardHeader>

      <CardBody className="space-y-4">
        {abierto && (
          <div className="space-y-3 rounded-comp-sm border border-linea bg-superficie-sec p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as TipoMovimientoCC)}
                >
                  {TIPOS_MOVIMIENTO_CC.map((k) => (
                    <option key={k} value={k}>
                      {ETIQUETA_MOVIMIENTO_CC[k]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label requerido>
                  Importe {signo === 1 ? "(suma a la deuda)" : signo === -1 ? "(resta)" : ""}
                </Label>
                <Input
                  inputMode="decimal"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              {llevaVencimiento && (
                <div>
                  <Label>Fecha de cobro</Label>
                  <Input
                    type="date"
                    value={vencimiento}
                    onChange={(e) => setVencimiento(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div>
              <Label>Nota</Label>
              <Textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="N° de comprobante, detalle…"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variante="secundario" tamano="sm" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button tamano="sm" onClick={guardar} disabled={guardando}>
                Registrar
              </Button>
            </div>
          </div>
        )}

        {movimientos.length === 0 ? (
          <p className="text-sm text-texto-tenue">Sin movimientos todavía.</p>
        ) : (
          <div className="tabla-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-linea text-left text-[11px] uppercase tracking-wide text-texto-sec">
                  <th className="py-2 pr-2">Fecha</th>
                  <th className="py-2 pr-2">Tipo</th>
                  <th className="py-2 pr-2">Nota</th>
                  <th className="py-2 pr-2">Vencimiento</th>
                  <th className="py-2 pr-2 text-right">Importe</th>
                  {puedeCorregir && <th className="w-10 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.id} className="border-b border-linea">
                    <td className="py-1.5 pr-2 whitespace-nowrap text-texto-sec">
                      {formatearFecha(m.created_at)}
                    </td>
                    <td className="py-1.5 pr-2">
                      <Badge tono={m.amount > 0 ? "alerta" : "exito"}>
                        {ETIQUETA_MOVIMIENTO_CC[m.kind]}
                      </Badge>
                    </td>
                    <td className="py-1.5 pr-2 text-texto-sec">{m.note ?? "—"}</td>
                    <td className="py-1.5 pr-2 whitespace-nowrap text-texto-sec">
                      {m.due_date ? formatearFecha(m.due_date) : "—"}
                    </td>
                    <td
                      className={`py-1.5 pr-2 text-right tabular-nums font-medium ${
                        m.amount > 0 ? "text-error" : "text-exito"
                      }`}
                    >
                      {m.amount > 0 ? "+" : ""}
                      {formatearMoneda(m.amount)}
                    </td>
                    {puedeCorregir && (
                      <td className="py-1.5">
                        <button
                          type="button"
                          onClick={() => setABorrar(m.id)}
                          className="rounded-comp-sm p-1 text-texto-sec hover:bg-error-suave hover:text-error"
                          aria-label="Eliminar movimiento"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>

      <ConfirmDialog
        abierto={!!aBorrar}
        onCerrar={() => setABorrar(null)}
        titulo="Eliminar movimiento"
        mensaje="Se recalcula el saldo del cliente. Queda registrado en la auditoría."
        textoConfirmar="Eliminar"
        onConfirmar={borrar}
      />
    </Card>
  );
}
