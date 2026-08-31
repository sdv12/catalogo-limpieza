"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function ConfirmDialog({
  abierto,
  onCerrar,
  onConfirmar,
  titulo,
  mensaje,
  textoConfirmar = "Confirmar",
  peligro = false,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onConfirmar: () => void | Promise<void>;
  titulo: string;
  mensaje: React.ReactNode;
  textoConfirmar?: string;
  peligro?: boolean;
}) {
  const [cargando, setCargando] = useState(false);

  async function confirmar() {
    setCargando(true);
    try {
      await onConfirmar();
      onCerrar();
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulo} ancho="sm">
      <div className="text-sm text-texto-sec">{mensaje}</div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variante="secundario" onClick={onCerrar} disabled={cargando}>
          Cancelar
        </Button>
        <Button
          variante={peligro ? "peligro" : "primario"}
          onClick={confirmar}
          disabled={cargando}
        >
          {cargando ? "Un momento…" : textoConfirmar}
        </Button>
      </div>
    </Modal>
  );
}
