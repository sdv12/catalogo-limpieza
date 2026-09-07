"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ArrowRight } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  ajustarCostosProveedor,
  propagarCostosProveedor,
} from "@/app/panel/[catalogo]/proveedores/actions";

type Modo = "percent" | "set";

export function SupplierCostTool({
  slug,
  supplierId,
}: {
  slug: string;
  supplierId: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  const [modo, setModo] = useState<Modo>("percent");
  const [valorTxt, setValorTxt] = useState("");
  const [round, setRound] = useState(true);
  const [prevAjuste, setPrevAjuste] = useState<{
    productos: number;
    con_costo: number;
  } | null>(null);
  const [confAjuste, setConfAjuste] = useState(false);

  const [soloSinCosto, setSoloSinCosto] = useState(false);
  const [prevProp, setPrevProp] = useState<{
    presentaciones: number;
    productos: number;
  } | null>(null);

  const [cargando, setCargando] = useState(false);
  const valor = Number(valorTxt.replace(",", "."));
  const valido =
    Number.isFinite(valor) && (modo === "set" ? valor >= 0 : valor !== 0);

  async function previewAjuste() {
    if (!valido) return toast.error("Ingresá un valor válido");
    setCargando(true);
    const r = await ajustarCostosProveedor(
      slug,
      supplierId,
      { mode: modo, value: valor, round },
      true,
    );
    setCargando(false);
    if (r.ok && r.data) setPrevAjuste(r.data);
    else toast.error(r.message);
  }

  async function aplicarAjuste() {
    setCargando(true);
    const r = await ajustarCostosProveedor(
      slug,
      supplierId,
      { mode: modo, value: valor, round },
      false,
    );
    setCargando(false);
    if (r.ok) {
      toast.success(r.message);
      setPrevAjuste(null);
      setValorTxt("");
      router.refresh();
    } else toast.error(r.message);
  }

  async function previewProp() {
    setCargando(true);
    const r = await propagarCostosProveedor(slug, supplierId, soloSinCosto, true);
    setCargando(false);
    if (r.ok && r.data) setPrevProp(r.data);
    else toast.error(r.message);
  }

  async function aplicarProp() {
    setCargando(true);
    const r = await propagarCostosProveedor(slug, supplierId, soloSinCosto, false);
    setCargando(false);
    if (r.ok) {
      toast.success(r.message);
      setPrevProp(null);
      router.refresh();
    } else toast.error(r.message);
  }

  return (
    <Card>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-texto"
      >
        Actualizar lista de costos
        <span className="font-normal text-texto-tenue">
          · cuando el proveedor manda precios nuevos
        </span>
        <ChevronDown
          size={16}
          className={`ml-auto text-texto-tenue transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>

      {abierto && (
        <CardBody className="space-y-5 border-t border-linea pt-4">
          {/* Paso 1 */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-texto-sec">
              1 · Ajustar el costo del proveedor
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Operación</Label>
                <Select
                  value={modo}
                  onChange={(e) => {
                    setModo(e.target.value as Modo);
                    setPrevAjuste(null);
                  }}
                >
                  <option value="percent">Subir / bajar un %</option>
                  <option value="set">Fijar un costo</option>
                </Select>
              </div>
              <div>
                <Label requerido>
                  {modo === "percent" ? "Porcentaje (ej: 8 o -3)" : "Costo a fijar"}
                </Label>
                <Input
                  inputMode="decimal"
                  value={valorTxt}
                  onChange={(e) => {
                    setValorTxt(e.target.value);
                    setPrevAjuste(null);
                  }}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-texto-sec">
              <input
                type="checkbox"
                checked={round}
                onChange={(e) => setRound(e.target.checked)}
              />
              Redondear a 2 decimales
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variante="secundario"
                tamano="sm"
                onClick={previewAjuste}
                disabled={cargando}
              >
                Previsualizar
              </Button>
              {prevAjuste && (
                <>
                  <span className="text-sm text-texto-sec">
                    {prevAjuste.con_costo === 0
                      ? "Ningún producto de este proveedor tiene costo cargado."
                      : `${prevAjuste.con_costo} de ${prevAjuste.productos} productos con costo se van a actualizar.`}
                  </span>
                  {prevAjuste.con_costo > 0 && (
                    <Button
                      tamano="sm"
                      onClick={() => setConfAjuste(true)}
                      disabled={cargando}
                    >
                      Aplicar
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Paso 2 */}
          <div className="space-y-3 border-t border-linea pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-texto-sec">
              2 · Pasar el costo a las presentaciones
            </p>
            <p className="text-sm text-texto-sec">
              Copia el costo del proveedor a cada presentación de sus productos.
              Es lo que después usa el reprecio por margen.
            </p>
            <label className="flex items-center gap-2 text-sm text-texto-sec">
              <input
                type="checkbox"
                checked={soloSinCosto}
                onChange={(e) => {
                  setSoloSinCosto(e.target.checked);
                  setPrevProp(null);
                }}
              />
              Solo las presentaciones que hoy no tienen costo
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variante="secundario"
                tamano="sm"
                onClick={previewProp}
                disabled={cargando}
              >
                Previsualizar
              </Button>
              {prevProp && (
                <>
                  <span className="text-sm text-texto-sec">
                    {prevProp.presentaciones === 0
                      ? "No hay presentaciones para actualizar."
                      : `${prevProp.presentaciones} presentaciones de ${prevProp.productos} productos.`}
                  </span>
                  {prevProp.presentaciones > 0 && (
                    <Button tamano="sm" onClick={aplicarProp} disabled={cargando}>
                      Aplicar
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Paso 3 */}
          <div className="border-t border-linea pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-texto-sec">
              3 · Recalcular precios por margen
            </p>
            <Link
              href={`/panel/${slug}/productos?proveedor=${supplierId}`}
              className="mt-2 inline-flex items-center gap-1.5 rounded-comp-sm border border-linea-fuerte bg-superficie px-3 py-1.5 text-sm text-texto hover:bg-superficie-sec"
            >
              Ir a Productos de este proveedor
              <ArrowRight size={14} />
            </Link>
            <p className="mt-1.5 text-xs text-texto-tenue">
              Ahí usá &ldquo;Reprecio en lote → Fijar margen sobre el costo&rdquo;.
            </p>
          </div>
        </CardBody>
      )}

      <ConfirmDialog
        abierto={confAjuste}
        onCerrar={() => setConfAjuste(false)}
        titulo="Actualizar costos del proveedor"
        mensaje={
          <>
            Se van a modificar los costos de{" "}
            <strong>{prevAjuste?.con_costo}</strong> productos. Queda registrado en
            la auditoría. ¿Continuar?
          </>
        }
        textoConfirmar="Aplicar"
        onConfirmar={aplicarAjuste}
      />
    </Card>
  );
}
