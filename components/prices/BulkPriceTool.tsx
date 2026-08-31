"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  previsualizarPrecios,
  aplicarPrecios,
} from "@/app/panel/[catalogo]/precios/actions";

type Tier = { id: string; name: string };
type CategoriaOpt = { id: string; label: string };
type Modo = "percent" | "amount" | "set";

export function BulkPriceTool({
  slug,
  tiers,
  categorias,
  soloLectura,
}: {
  slug: string;
  tiers: Tier[];
  categorias: CategoriaOpt[];
  soloLectura: boolean;
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState("");
  const [tierIds, setTierIds] = useState<string[]>([]);
  const [modo, setModo] = useState<Modo>("percent");
  const [valorTxt, setValorTxt] = useState("");
  const [round, setRound] = useState(true);
  const [preview, setPreview] = useState<number | null>(null);
  const [cargando, setCargando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  if (soloLectura) return null;

  const valor = Number(valorTxt.replace(",", "."));
  const valido = Number.isFinite(valor) && (modo === "set" ? valor >= 0 : valor !== 0);

  const input = () => ({
    categoryId: categoryId || null,
    tierIds,
    mode: modo,
    value: valor,
    round,
  });

  async function previsualizar() {
    if (!valido) {
      toast.error("Ingresá un valor válido");
      return;
    }
    setCargando(true);
    const r = await previsualizarPrecios(slug, input());
    setCargando(false);
    if (!r.ok || !r.data) {
      toast.error(r.message || "No se pudo previsualizar");
      return;
    }
    setPreview(r.data.count);
  }

  async function aplicar() {
    setCargando(true);
    const r = await aplicarPrecios(slug, input());
    setCargando(false);
    if (r.ok) {
      toast.success(r.message);
      setPreview(null);
      setValorTxt("");
      router.refresh();
    } else {
      toast.error(r.message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actualización de precios en lote</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Categoría</Label>
            <Select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPreview(null);
              }}
            >
              <option value="">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
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
                      setPreview(null);
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Operación</Label>
            <Select
              value={modo}
              onChange={(e) => {
                setModo(e.target.value as Modo);
                setPreview(null);
              }}
            >
              <option value="percent">Aumentar / bajar un %</option>
              <option value="amount">Sumar / restar un monto</option>
              <option value="set">Fijar un precio</option>
            </Select>
          </div>
          <div>
            <Label requerido>
              {modo === "percent"
                ? "Porcentaje (ej: 10 o -5)"
                : modo === "amount"
                  ? "Monto (ej: 200 o -50)"
                  : "Precio a fijar"}
            </Label>
            <Input
              type="text"
              inputMode="decimal"
              value={valorTxt}
              onChange={(e) => {
                setValorTxt(e.target.value);
                setPreview(null);
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
          <Button variante="secundario" onClick={previsualizar} disabled={cargando}>
            Previsualizar
          </Button>
          {preview !== null && (
            <>
              <span className="text-sm text-texto-sec">
                {preview === 0
                  ? "Ningún precio coincide con los filtros."
                  : `${preview} ${preview === 1 ? "precio" : "precios"} se van a modificar.`}
              </span>
              {preview > 0 && (
                <Button onClick={() => setConfirmar(true)} disabled={cargando}>
                  Aplicar
                </Button>
              )}
            </>
          )}
        </div>
      </CardBody>

      <ConfirmDialog
        abierto={confirmar}
        onCerrar={() => setConfirmar(false)}
        titulo="Aplicar cambio de precios"
        mensaje={
          <>
            Se van a modificar <strong>{preview}</strong> precios. La acción queda
            registrada en la auditoría. ¿Continuar?
          </>
        }
        textoConfirmar="Aplicar"
        onConfirmar={aplicar}
      />
    </Card>
  );
}
