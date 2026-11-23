"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownUp, Ban, Lock, Mail, Unlock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Label, Select, FieldHint } from "@/components/ui/Field";
import { notificar } from "@/lib/ui";
import { formatearMoneda } from "@/lib/format";
import { parsearNumero } from "@/lib/validation/product";
import {
  abrirCaja,
  anularRecibo,
  cerrarCaja,
  reenviarRecibo,
  registrarMovimientoCaja,
} from "@/app/panel/[catalogo]/caja/actions";

export function AbrirCaja({ slug }: { slug: string }) {
  const router = useRouter();
  const [inicial, setInicial] = useState("0");
  const [ocupado, setOcupado] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="sm:w-56">
        <Label>Efectivo con el que arrancás</Label>
        <Input inputMode="decimal" value={inicial} onChange={(e) => setInicial(e.target.value)} />
        <FieldHint>El cambio que tenés en la caja al empezar.</FieldHint>
      </div>
      <Button
        disabled={ocupado}
        onClick={async () => {
          setOcupado(true);
          const r = await abrirCaja(slug, parsearNumero(inicial) ?? -1);
          setOcupado(false);
          if (notificar(r)) router.refresh();
        }}
        className="sm:mb-5"
      >
        <Unlock size={15} />
        Abrir caja
      </Button>
    </div>
  );
}

export function MovimientoCajaBoton({ slug }: { slug: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<"ingreso" | "egreso">("egreso");
  const [importe, setImporte] = useState("");
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  return (
    <>
      <Button variante="secundario" onClick={() => setAbierto(true)}>
        <ArrowDownUp size={15} />
        Ingreso / egreso
      </Button>
      <Modal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Ingreso o egreso de efectivo" ancho="sm">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as "ingreso" | "egreso")}>
                <option value="egreso">Egreso (sale plata)</option>
                <option value="ingreso">Ingreso (entra plata)</option>
              </Select>
            </div>
            <div>
              <Label requerido>Importe</Label>
              <Input inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} />
            </div>
          </div>
          <div>
            <Label requerido>Motivo</Label>
            <Input
              value={motivo}
              maxLength={200}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={tipo === "egreso" ? "Ej: retiro para el dueño, pago de flete…" : "Ej: cambio que agregó el encargado…"}
            />
            <FieldHint>Solo efectivo. Queda registrado con tu nombre.</FieldHint>
          </div>
          <div className="flex justify-end gap-2">
            <Button variante="secundario" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button
              disabled={ocupado}
              onClick={async () => {
                setOcupado(true);
                const r = await registrarMovimientoCaja(slug, tipo, parsearNumero(importe) ?? 0, motivo);
                setOcupado(false);
                if (notificar(r)) {
                  setAbierto(false);
                  setImporte("");
                  setMotivo("");
                  router.refresh();
                }
              }}
            >
              Registrar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function CerrarCajaBoton({
  slug,
  sessionId,
  esperado,
  ajena,
}: {
  slug: string;
  sessionId: string;
  esperado: number;
  /** Es la caja de otra persona (cierre por un encargado). */
  ajena?: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [contado, setContado] = useState("");
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const c = parsearNumero(contado);
  const dif = c != null ? Math.round((c - esperado) * 100) / 100 : null;
  return (
    <>
      <Button variante={ajena ? "secundario" : "primario"} onClick={() => setAbierto(true)}>
        <Lock size={15} />
        Cerrar caja
      </Button>
      <Modal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Cerrar caja (arqueo)" ancho="sm">
        <div className="space-y-3">
          <p className="text-sm text-texto-sec">
            Contá el efectivo que hay en la caja y anotalo. Solo efectivo: transferencias, Mercado
            Pago y tarjetas no se cuentan acá.
          </p>
          <div>
            <Label requerido>Efectivo contado</Label>
            <Input inputMode="decimal" autoFocus value={contado} onChange={(e) => setContado(e.target.value)} />
          </div>
          {dif != null && (
            <p className={dif === 0 ? "text-sm text-exito" : "text-sm text-alerta"}>
              {dif === 0
                ? "Coincide con lo esperado."
                : dif > 0
                  ? `Sobran ${formatearMoneda(dif)} respecto de lo esperado.`
                  : `Faltan ${formatearMoneda(-dif)} respecto de lo esperado.`}
            </p>
          )}
          <div>
            <Label requerido={dif != null && dif !== 0}>Nota</Label>
            <Input
              value={nota}
              maxLength={300}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Obligatoria si hay diferencia"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variante="secundario" onClick={() => setAbierto(false)}>
              Volver
            </Button>
            <Button
              disabled={ocupado || c == null}
              onClick={async () => {
                setOcupado(true);
                const r = await cerrarCaja(slug, sessionId, c ?? -1, nota);
                setOcupado(false);
                if (notificar(r)) {
                  setAbierto(false);
                  router.refresh();
                }
              }}
            >
              Cerrar caja
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function AnularReciboBoton({ slug, reciboId, numero }: { slug: string; reciboId: string; numero: number }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-comp-sm p-1 text-texto-sec hover:bg-error-suave hover:text-error"
        aria-label={`Anular recibo ${numero}`}
        title="Anular recibo"
      >
        <Ban size={14} />
      </button>
      <Modal abierto={abierto} onCerrar={() => setAbierto(false)} titulo={`Anular recibo N° ${numero}`} ancho="sm">
        <div className="space-y-3">
          <p className="rounded-comp-sm bg-alerta-suave px-3 py-2 text-sm text-alerta">
            El recibo queda anulado (no se borra). Si era un pago de cuenta corriente, la deuda del
            cliente vuelve a subir; si era de un pedido, vuelve a figurar como pendiente de cobro.
          </p>
          <div>
            <Label requerido>Motivo</Label>
            <Input autoFocus value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variante="secundario" onClick={() => setAbierto(false)}>
              Volver
            </Button>
            <Button
              variante="peligro"
              disabled={ocupado || motivo.trim().length < 3}
              onClick={async () => {
                setOcupado(true);
                const r = await anularRecibo(slug, reciboId, motivo);
                setOcupado(false);
                if (notificar(r)) {
                  setAbierto(false);
                  router.refresh();
                }
              }}
            >
              Anular
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function ReenviarReciboBoton({ slug, reciboId }: { slug: string; reciboId: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  return (
    <Button
      variante="secundario"
      disabled={ocupado}
      onClick={async () => {
        setOcupado(true);
        const r = await reenviarRecibo(slug, reciboId);
        setOcupado(false);
        if (notificar(r)) router.refresh();
      }}
    >
      <Mail size={15} />
      Enviar por mail
    </Button>
  );
}
