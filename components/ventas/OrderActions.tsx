"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, Printer, XCircle, ArrowRight, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Label, FieldHint } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ModalCobroVenta } from "@/components/caja/ModalCobroVenta";
import { notificar } from "@/lib/ui";
import {
  ETIQUETA_ESTADO_PEDIDO,
  SIGUIENTES_ESTADOS,
  type EstadoPedido,
} from "@/lib/ventas";
import {
  avanzarPedido,
  cancelarPedido,
  confirmarPedido,
} from "@/app/panel/[catalogo]/ventas/actions";

export function OrderActions({
  slug,
  id,
  estado,
  puedeEditar,
  esAdmin,
  contado,
  total,
  faltaCobrar,
}: {
  slug: string;
  id: string;
  estado: EstadoPedido;
  puedeEditar: boolean;
  esAdmin: boolean;
  /** Venta de contado: se cobra al confirmar (o al entregar). */
  contado: boolean;
  total: number;
  /** Lo que falta cobrar de un contado ya confirmado. */
  faltaCobrar: number;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");

  const siguientes = SIGUIENTES_ESTADOS[estado] ?? [];
  const puedeCancelar =
    puedeEditar && estado !== "entregado" && estado !== "cancelado" && (estado === "nuevo" || esAdmin);

  async function correr(fn: () => Promise<{ ok: boolean; message: string }>) {
    setOcupado(true);
    const r = await fn();
    setOcupado(false);
    if (notificar(r)) router.refresh();
    return r.ok;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {puedeEditar && estado === "nuevo" && (
        <>
          <Link href={`/panel/${slug}/ventas/${id}/editar`}>
            <Button variante="secundario" disabled={ocupado}>
              <Pencil size={15} />
              Editar
            </Button>
          </Link>
          <Button onClick={() => setConfirmando(true)} disabled={ocupado}>
            <CheckCircle2 size={15} />
            Confirmar
          </Button>
        </>
      )}

      {puedeEditar && contado && estado !== "nuevo" && estado !== "cancelado" && faltaCobrar > 0 && (
        <Link href={`/panel/${slug}/caja/cobrar?pedido=${id}`}>
          <Button>
            <Wallet size={15} />
            Registrar cobro
          </Button>
        </Link>
      )}

      {puedeEditar &&
        siguientes.map((s, i) => (
          <Button
            key={s}
            variante={i === 0 ? "primario" : "secundario"}
            disabled={ocupado}
            onClick={() => correr(() => avanzarPedido(slug, id, s))}
          >
            <ArrowRight size={15} />
            {ETIQUETA_ESTADO_PEDIDO[s]}
          </Button>
        ))}

      <a href={`/imprimir/${slug}/pedido/${id}`} target="_blank" rel="noopener noreferrer">
        <Button variante="secundario">
          <Printer size={15} />
          Imprimir
        </Button>
      </a>

      {puedeCancelar && (
        <Button variante="fantasma" disabled={ocupado} onClick={() => setCancelando(true)}>
          <XCircle size={15} />
          Cancelar pedido
        </Button>
      )}

      {contado && total > 0 ? (
        confirmando && (
          <ModalCobroVenta
            abierto
            total={total}
            onCerrar={() => setConfirmando(false)}
            onConfirmar={async (cobro) => {
              const ok = await correr(() => confirmarPedido(slug, id, cobro));
              if (ok) setConfirmando(false);
            }}
          />
        )
      ) : (
      <ConfirmDialog
        abierto={confirmando}
        onCerrar={() => setConfirmando(false)}
        titulo="Confirmar venta"
        mensaje="Se descuenta el stock y, si es a cuenta corriente, se carga la deuda al cliente. Después ya no se puede editar."
        textoConfirmar="Confirmar"
        onConfirmar={async () => {
          setConfirmando(false);
          await correr(() => confirmarPedido(slug, id, { pagos: null, cobrarAlEntregar: false }));
        }}
      />
      )}

      <Modal abierto={cancelando} onCerrar={() => setCancelando(false)} titulo="Cancelar pedido" ancho="sm">
        <div className="space-y-3">
          {estado !== "nuevo" && (
            <p className="rounded-comp-sm bg-alerta-suave px-3 py-2 text-sm text-alerta">
              El pedido ya estaba confirmado: se devuelve el stock y se anula el cargo en la
              cuenta corriente del cliente.
            </p>
          )}
          <div>
            <Label requerido>Motivo</Label>
            <Input
              autoFocus
              value={motivo}
              maxLength={200}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: el cliente se arrepintió, pedido duplicado…"
            />
            <FieldHint>Queda registrado en Actividad.</FieldHint>
          </div>
          <div className="flex justify-end gap-2">
            <Button variante="secundario" onClick={() => setCancelando(false)}>
              Volver
            </Button>
            <Button
              variante="peligro"
              disabled={ocupado || motivo.trim().length < 3}
              onClick={async () => {
                const ok = await correr(() => cancelarPedido(slug, id, motivo));
                if (ok) {
                  setCancelando(false);
                  setMotivo("");
                }
              }}
            >
              Cancelar pedido
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
