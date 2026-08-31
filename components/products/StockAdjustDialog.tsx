"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea, FieldHint } from "@/components/ui/Field";
import {
  MOTIVOS_STOCK,
  ETIQUETA_MOTIVO_STOCK,
  type MotivoStock,
} from "@/lib/constants";
import { ajustarStock } from "@/app/panel/[catalogo]/productos/actions";
import { formatearNumero } from "@/lib/format";

export function StockAdjustDialog({
  slug,
  variante,
  abierto,
  onCerrar,
}: {
  slug: string;
  variante: { id: string; name: string; stock: number };
  abierto: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<"sumar" | "restar" | "fijar">("sumar");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState<MotivoStock>("ingreso");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cant = Number(cantidad);
  const delta =
    modo === "sumar" ? cant : modo === "restar" ? -cant : cant - variante.stock;
  const resultado = variante.stock + delta;

  async function guardar() {
    if (!Number.isFinite(cant) || cantidad === "") {
      toast.error("Ingresá una cantidad");
      return;
    }
    if (delta === 0) {
      toast.error("El ajuste no cambia el stock");
      return;
    }
    setGuardando(true);
    const r = await ajustarStock(slug, variante.id, {
      delta,
      reason: motivo,
      note: nota,
    });
    setGuardando(false);
    if (r.ok) {
      toast.success(`Stock de "${variante.name}" ajustado`);
      setCantidad("");
      setNota("");
      onCerrar();
      router.refresh();
    } else {
      toast.error(r.message);
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={`Ajustar stock — ${variante.name}`}
      ancho="sm"
    >
      <p className="text-sm text-texto-sec">
        Stock actual:{" "}
        <strong className="text-texto">{formatearNumero(variante.stock)}</strong>
      </p>

      <div className="mt-4 flex gap-1 rounded-comp-sm bg-superficie-sec p-1">
        {(["sumar", "restar", "fijar"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModo(m)}
            className={`flex-1 rounded-comp-sm py-1.5 text-sm font-medium capitalize ${
              modo === m
                ? "bg-superficie text-texto shadow-[var(--sombra)]"
                : "text-texto-sec"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <Label htmlFor="cant" requerido>
          {modo === "fijar" ? "Nuevo stock" : "Cantidad"}
        </Label>
        <Input
          id="cant"
          type="number"
          min="0"
          step="any"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          autoFocus
        />
        {cantidad !== "" && Number.isFinite(cant) && (
          <FieldHint>
            {formatearNumero(variante.stock)} → {formatearNumero(resultado)} (
            {delta >= 0 ? "+" : ""}
            {formatearNumero(delta)})
          </FieldHint>
        )}
      </div>

      <div className="mt-3">
        <Label htmlFor="motivo" requerido>
          Motivo
        </Label>
        <Select
          id="motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value as MotivoStock)}
        >
          {MOTIVOS_STOCK.filter((m) => m !== "importacion").map((m) => (
            <option key={m} value={m}>
              {ETIQUETA_MOTIVO_STOCK[m]}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-3">
        <Label htmlFor="nota">Nota (opcional)</Label>
        <Textarea
          id="nota"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
        />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variante="secundario" onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Ajustar stock"}
        </Button>
      </div>
    </Modal>
  );
}
