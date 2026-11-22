"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldHint } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { notificar } from "@/lib/ui";
import { cn } from "@/lib/cn";
import { formatearMoneda, formatearFecha } from "@/lib/format";
import { parsearNumero } from "@/lib/validation/product";
import { precioEspecialVigente } from "@/lib/validation/precio-especial";
import {
  buscarVariantesParaPrecio,
  guardarPrecioEspecial,
  eliminarPrecioEspecial,
  type VarianteParaPrecio,
} from "@/app/panel/[catalogo]/clientes/precios-especiales";

export type PrecioEspecialFila = {
  id: string;
  variantId: string;
  producto: string;
  presentacion: string;
  sku: string;
  precioGeneral: number | null;
  precio: number;
  motivo: string;
  vence: string | null;
  actualizado: string;
};

/** Diferencia del precio especial contra el general, en % (negativo = descuento). */
function diferencia(especial: number, general: number | null): number | null {
  if (general == null || general <= 0) return null;
  return Math.round((especial / general - 1) * 1000) / 10;
}

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CustomerSpecialPrices({
  slug,
  customerId,
  nivel,
  precios,
  puedeEditar,
}: {
  slug: string;
  customerId: string;
  /** Nombre del nivel de precio que se usa como "precio general" del cliente. */
  nivel: string | null;
  precios: PrecioEspecialFila[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<VarianteParaPrecio[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [elegida, setElegida] = useState<VarianteParaPrecio | null>(null);
  const [precio, setPrecio] = useState("");
  const [motivo, setMotivo] = useState("");
  const [vence, setVence] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aQuitar, setAQuitar] = useState<PrecioEspecialFila | null>(null);
  const hoy = hoyISO();

  // búsqueda con pequeña espera mientras se escribe
  useEffect(() => {
    if (!abierto || elegida) return;
    const q = busqueda.trim();
    if (q.length < 2) return;
    const t = setTimeout(async () => {
      setBuscando(true);
      setResultados(await buscarVariantesParaPrecio(slug, customerId, q));
      setBuscando(false);
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, abierto, elegida, slug, customerId]);

  function reiniciar() {
    setBusqueda("");
    setResultados([]);
    setElegida(null);
    setPrecio("");
    setMotivo("");
    setVence("");
  }

  function editar(f: PrecioEspecialFila) {
    setElegida({
      variantId: f.variantId,
      producto: f.producto,
      presentacion: f.presentacion,
      sku: f.sku,
      precioGeneral: f.precioGeneral,
      costo: null,
    });
    setPrecio(String(f.precio));
    setMotivo(f.motivo);
    setVence(f.vence ?? "");
    setAbierto(true);
  }

  const precioNum = parsearNumero(precio);
  const bajoCosto =
    elegida?.costo != null && precioNum != null && precioNum < elegida.costo;
  const dif = elegida && precioNum != null ? diferencia(precioNum, elegida.precioGeneral) : null;

  async function guardar() {
    if (!elegida) return notificar({ ok: false, message: "Elegí un producto" });
    if (precioNum == null) return notificar({ ok: false, message: "Ingresá el precio especial" });
    if (vence && vence < hoy) {
      return notificar({ ok: false, message: "La fecha de vencimiento ya pasó" });
    }
    if (
      bajoCosto &&
      !window.confirm("Este precio queda POR DEBAJO DEL COSTO. ¿Guardar igual?")
    ) {
      return;
    }
    setGuardando(true);
    const r = await guardarPrecioEspecial(slug, customerId, {
      variantId: elegida.variantId,
      price: precioNum,
      reason: motivo,
      endsOn: vence || null,
    });
    setGuardando(false);
    if (notificar(r)) {
      reiniciar();
      setAbierto(false);
      router.refresh();
    }
  }

  async function quitar() {
    if (!aQuitar) return;
    const r = await eliminarPrecioEspecial(slug, customerId, aQuitar.id);
    setAQuitar(null);
    if (notificar(r)) router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Precios especiales</CardTitle>
        {puedeEditar && !abierto && (
          <Button
            tamano="sm"
            variante="secundario"
            onClick={() => {
              reiniciar();
              setAbierto(true);
            }}
          >
            <Plus size={14} />
            Agregar
          </Button>
        )}
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-texto-sec">
          Precio distinto para <strong className="text-texto">este cliente</strong> en
          productos puntuales. No cambia el precio general, ni el de otros clientes, ni la
          tienda online.
          {nivel && (
            <>
              {" "}Se compara contra su nivel: <strong className="text-texto">{nivel}</strong>.
            </>
          )}
        </p>

        {abierto && (
          <div className="space-y-3 rounded-comp-sm border border-linea bg-superficie-sec p-3">
            {!elegida ? (
              <div>
                <Label>Producto</Label>
                <div className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-tenue"
                  />
                  <Input
                    autoFocus
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscá por nombre, marca o SKU…"
                    className="pl-8"
                  />
                </div>
                {buscando && <FieldHint>Buscando…</FieldHint>}
                {resultados.length > 0 && (
                  <ul className="mt-1 max-h-60 divide-y divide-linea overflow-y-auto rounded-comp-sm border border-linea bg-superficie">
                    {resultados.map((r) => (
                      <li key={r.variantId}>
                        <button
                          type="button"
                          onClick={() => setElegida(r)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-superficie-sec"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-texto">{r.producto}</span>
                            <span className="block truncate text-xs text-texto-tenue">
                              {r.presentacion} · {r.sku}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums text-texto-sec">
                            {r.precioGeneral != null ? formatearMoneda(r.precioGeneral) : "—"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!buscando && busqueda.trim().length >= 2 && resultados.length === 0 && (
                  <FieldHint>No se encontraron productos.</FieldHint>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 rounded-comp-sm bg-superficie px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-texto">{elegida.producto}</p>
                    <p className="truncate text-xs text-texto-tenue">
                      {elegida.presentacion} · {elegida.sku}
                    </p>
                    <p className="mt-1 text-xs text-texto-sec">
                      Precio general:{" "}
                      {elegida.precioGeneral != null
                        ? formatearMoneda(elegida.precioGeneral)
                        : "sin precio en su nivel"}
                      {elegida.costo != null && <> · Costo: {formatearMoneda(elegida.costo)}</>}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={reiniciar}
                    className="shrink-0 text-xs text-primario hover:underline"
                  >
                    Cambiar
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label requerido>Precio especial</Label>
                    <Input
                      inputMode="decimal"
                      value={precio}
                      onChange={(e) => setPrecio(e.target.value)}
                      placeholder="0,00"
                      className={cn(bajoCosto && "border-error")}
                    />
                    {dif != null && (
                      <FieldHint>
                        {dif < 0
                          ? `${Math.abs(dif)}% menos que el precio general`
                          : dif > 0
                            ? `${dif}% más que el precio general`
                            : "Igual al precio general"}
                      </FieldHint>
                    )}
                    {bajoCosto && (
                      <p className="mt-1 text-xs text-error">
                        Queda por debajo del costo (solo un administrador lo puede dar).
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Vence (opcional)</Label>
                    <Input
                      type="date"
                      value={vence}
                      min={hoy}
                      onChange={(e) => setVence(e.target.value)}
                    />
                    <FieldHint>Vacío = hasta que lo quites. Vale hasta ese día inclusive.</FieldHint>
                  </div>
                </div>
                <div>
                  <Label requerido>Motivo</Label>
                  <Input
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    maxLength={200}
                    placeholder="Ej: acuerdo por volumen, cliente histórico, promo pactada…"
                  />
                  <FieldHint>Queda registrado en Actividad junto con quién lo dio.</FieldHint>
                </div>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variante="secundario"
                tamano="sm"
                onClick={() => {
                  reiniciar();
                  setAbierto(false);
                }}
              >
                Cancelar
              </Button>
              <Button tamano="sm" onClick={guardar} disabled={guardando || !elegida}>
                Guardar
              </Button>
            </div>
          </div>
        )}

        {precios.length === 0 ? (
          <p className="text-sm text-texto-tenue">
            Sin precios especiales: este cliente paga el precio de su nivel.
          </p>
        ) : (
          <div className="tabla-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-linea text-left text-[11px] uppercase tracking-wide text-texto-sec">
                  <th className="py-2 pr-2">Producto</th>
                  <th className="py-2 pr-2 text-right">General</th>
                  <th className="py-2 pr-2 text-right">Especial</th>
                  <th className="py-2 pr-2">Vence</th>
                  <th className="py-2 pr-2">Motivo</th>
                  {puedeEditar && <th className="w-16 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {precios.map((p) => {
                  const vigente = precioEspecialVigente(p.vence, hoy);
                  const d = diferencia(p.precio, p.precioGeneral);
                  return (
                    <tr
                      key={p.id}
                      className={cn("border-b border-linea", !vigente && "opacity-60")}
                    >
                      <td className="py-1.5 pr-2">
                        <span className="block text-texto">{p.producto}</span>
                        <span className="block text-xs text-texto-tenue">
                          {p.presentacion} · {p.sku}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-texto-sec">
                        {p.precioGeneral != null ? formatearMoneda(p.precioGeneral) : "—"}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        <span className="font-medium text-texto">{formatearMoneda(p.precio)}</span>
                        {d != null && d !== 0 && (
                          <span
                            className={cn(
                              "block text-xs",
                              d < 0 ? "text-exito" : "text-alerta",
                            )}
                          >
                            {d > 0 ? "+" : ""}
                            {d}%
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">
                        {p.vence ? (
                          vigente ? (
                            <span className="text-texto-sec">{formatearFecha(p.vence)}</span>
                          ) : (
                            <Badge tono="neutro">Vencido</Badge>
                          )
                        ) : (
                          <span className="text-texto-tenue">Sin vencimiento</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 text-texto-sec">{p.motivo}</td>
                      {puedeEditar && (
                        <td className="py-1.5">
                          <div className="flex justify-end gap-0.5">
                            <button
                              type="button"
                              onClick={() => editar(p)}
                              className="rounded-comp-sm p-1 text-texto-sec hover:bg-superficie-sec hover:text-texto"
                              aria-label="Editar precio especial"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setAQuitar(p)}
                              className="rounded-comp-sm p-1 text-texto-sec hover:bg-error-suave hover:text-error"
                              aria-label="Quitar precio especial"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>

      <ConfirmDialog
        abierto={!!aQuitar}
        onCerrar={() => setAQuitar(null)}
        titulo="Quitar precio especial"
        mensaje={`${aQuitar?.producto ?? ""} vuelve al precio general para este cliente. Queda registrado en Actividad.`}
        textoConfirmar="Quitar"
        onConfirmar={quitar}
      />
    </Card>
  );
}
