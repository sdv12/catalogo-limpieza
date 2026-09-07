"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Tag, TriangleAlert } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  previsualizarReprecio,
  aplicarReprecio,
  type FiltroProductos,
  type ReprecioResultado,
} from "@/app/panel/[catalogo]/precios/actions";

type Tier = { id: string; name: string };
type Modo = "percent" | "amount" | "set" | "margin";

const ETIQUETA_MODO: Record<Modo, string> = {
  percent: "Aumentar / bajar un %",
  amount: "Sumar / restar un monto",
  set: "Fijar un precio",
  margin: "Fijar margen sobre el costo",
};

export function ReprecioContextual({
  slug,
  tiers,
  filtro,
  total,
  hayFiltro,
}: {
  slug: string;
  tiers: Tier[];
  filtro: FiltroProductos;
  total: number;
  hayFiltro: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [tierIds, setTierIds] = useState<string[]>([]);
  const [modo, setModo] = useState<Modo>("percent");
  const [valorTxt, setValorTxt] = useState("");
  const [round, setRound] = useState(true);
  const [preview, setPreview] = useState<ReprecioResultado | null>(null);
  const [cargando, setCargando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const valor = Number(valorTxt.replace(",", "."));
  const valido =
    Number.isFinite(valor) &&
    (modo === "set" || modo === "margin" ? valor >= 0 : valor !== 0);

  const input = () => ({
    filtro,
    tierIds,
    mode: modo,
    value: valor,
    round,
  });

  const resetPreview = () => setPreview(null);

  async function previsualizar() {
    if (!valido) {
      toast.error("Ingresá un valor válido");
      return;
    }
    setCargando(true);
    const r = await previsualizarReprecio(slug, input());
    setCargando(false);
    if (!r.ok || !r.data) {
      toast.error(r.message || "No se pudo previsualizar");
      return;
    }
    setPreview(r.data);
  }

  async function aplicar() {
    setCargando(true);
    const r = await aplicarReprecio(slug, input());
    setCargando(false);
    if (r.ok) {
      toast.success(r.message);
      setPreview(null);
      setValorTxt("");
      setAbierto(false);
      router.refresh();
    } else {
      toast.error(r.message);
    }
  }

  const alcance = hayFiltro
    ? `los ${total} productos del filtro actual`
    : `los ${total} productos del catálogo`;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-texto"
      >
        <Tag size={15} className="text-texto-tenue" />
        Reprecio en lote
        <span className="font-normal text-texto-tenue">· {alcance}</span>
        <ChevronDown
          size={16}
          className={`ml-auto text-texto-tenue transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>

      {abierto && (
        <CardBody className="space-y-4 border-t border-linea pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Operación</Label>
              <Select
                value={modo}
                onChange={(e) => {
                  setModo(e.target.value as Modo);
                  resetPreview();
                }}
              >
                {(Object.keys(ETIQUETA_MODO) as Modo[]).map((m) => (
                  <option key={m} value={m}>
                    {ETIQUETA_MODO[m]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label requerido>
                {modo === "percent"
                  ? "Porcentaje (ej: 10 o -5)"
                  : modo === "amount"
                    ? "Monto (ej: 200 o -50)"
                    : modo === "margin"
                      ? "Margen % sobre el costo (ej: 40)"
                      : "Precio a fijar"}
              </Label>
              <Input
                type="text"
                inputMode="decimal"
                value={valorTxt}
                onChange={(e) => {
                  setValorTxt(e.target.value);
                  resetPreview();
                }}
              />
            </div>
          </div>

          <div>
            <Label>Niveles afectados</Label>
            <div className="flex flex-wrap gap-1.5 pt-1.5">
              {tiers.map((t) => {
                const on = tierIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTierIds((s) =>
                        on ? s.filter((x) => x !== t.id) : [...s, t.id],
                      );
                      resetPreview();
                    }}
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      on
                        ? "border-primario bg-primario-suave text-primario-fuerte"
                        : "border-linea text-texto-sec hover:bg-superficie-sec"
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-texto-tenue">
              Sin selección = todos los niveles.
            </p>
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
            <Button variante="secundario" onClick={previsualizar} disabled={cargando}>
              Previsualizar
            </Button>
            {preview && (
              <>
                <span className="text-sm text-texto-sec">
                  {preview.precios === 0
                    ? "Ningún precio coincide con los filtros."
                    : `${preview.productos} ${preview.productos === 1 ? "producto" : "productos"} · ${preview.precios} ${preview.precios === 1 ? "precio" : "precios"} a modificar.`}
                </span>
                {preview.precios > 0 && (
                  <Button onClick={() => setConfirmar(true)} disabled={cargando}>
                    Aplicar
                  </Button>
                )}
              </>
            )}
          </div>

          {preview && modo === "margin" && preview.sin_costo > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-alerta">
              <TriangleAlert size={13} className="mt-0.5 shrink-0" />
              {preview.sin_costo} {preview.sin_costo === 1 ? "precio" : "precios"} sin
              costo cargado se van a omitir. Cargá el costo en la presentación para
              incluirlos.
            </p>
          )}
        </CardBody>
      )}

      <ConfirmDialog
        abierto={confirmar}
        onCerrar={() => setConfirmar(false)}
        titulo="Aplicar cambio de precios"
        mensaje={
          <>
            Se van a modificar <strong>{preview?.precios}</strong> precios de{" "}
            <strong>{preview?.productos}</strong> productos. Queda registrado en la
            auditoría. ¿Continuar?
          </>
        }
        textoConfirmar="Aplicar"
        onConfirmar={aplicar}
      />
    </Card>
  );
}
