"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FieldHint } from "@/components/ui/Field";
import { formatearMoneda } from "@/lib/format";
import { notificar } from "@/lib/ui";
import {
  MediosPago,
  nuevaLineaPago,
  resolverPago,
  type LineaPagoEditable,
} from "@/components/caja/MediosPago";
import type { CobroConfirmacion } from "@/app/panel/[catalogo]/ventas/actions";

/**
 * Al confirmar una venta de contado: cómo paga (uno o varios medios, con
 * vuelto) o "cobrar al entregar" (contra entrega).
 */
export function ModalCobroVenta({
  abierto,
  total,
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean;
  total: number;
  onCerrar: () => void;
  onConfirmar: (cobro: CobroConfirmacion) => Promise<void>;
}) {
  const [lineas, setLineas] = useState<LineaPagoEditable[]>(() => [
    nuevaLineaPago("efectivo", String(total)),
  ]);
  const [alEntregar, setAlEntregar] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function confirmar() {
    if (alEntregar) {
      setOcupado(true);
      await onConfirmar({ pagos: null, cobrarAlEntregar: true });
      setOcupado(false);
      return;
    }
    const r = resolverPago(lineas, total);
    if (r.error) return notificar({ ok: false, message: r.error });
    setOcupado(true);
    await onConfirmar({ pagos: r.lineas, cobrarAlEntregar: false });
    setOcupado(false);
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Cobrar la venta" ancho="md">
      <div className="space-y-4">
        <p className="text-sm text-texto-sec">
          Total a cobrar{" "}
          <span className="text-lg font-semibold tabular-nums text-texto">{formatearMoneda(total)}</span>
        </p>

        {!alEntregar && <MediosPago lineas={lineas} onChange={setLineas} total={total} />}

        <label className="flex items-start gap-2 text-sm text-texto">
          <input
            type="checkbox"
            checked={alEntregar}
            onChange={(e) => setAlEntregar(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Cobrar al entregar (contra entrega)
            <span className="block text-xs text-texto-sec">
              El pedido se confirma sin cobrar. No se va a poder marcar como Entregado hasta registrar el cobro.
            </span>
          </span>
        </label>
        {!alEntregar && (
          <FieldHint>Queda en tu caja con un recibo numerado. Si el cliente tiene email, se lo mandamos.</FieldHint>
        )}

        <div className="flex justify-end gap-2">
          <Button variante="secundario" onClick={onCerrar} disabled={ocupado}>
            Volver
          </Button>
          <Button onClick={confirmar} disabled={ocupado}>
            {ocupado ? "Confirmando…" : alEntregar ? "Confirmar sin cobrar" : "Cobrar y confirmar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
