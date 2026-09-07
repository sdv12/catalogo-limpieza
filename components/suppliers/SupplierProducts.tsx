"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Star, ExternalLink, Search, Check } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { notificar } from "@/lib/ui";
import { formatearMoneda } from "@/lib/format";
import {
  buscarProductosProveedor,
  agregarProductosAProveedor,
  desvincularProveedor,
  vincularProveedor,
} from "@/app/panel/[catalogo]/proveedores/actions";

type FilaProducto = {
  product_id: string;
  name: string;
  brand: string | null;
  base_sku: string | null;
  is_deleted: boolean;
  supplier_sku: string | null;
  cost: number | null;
  is_primary: boolean;
  min_price: number | null;
  min_variant_cost: number | null;
  variant_count: number;
};

type Sugerencia = {
  id: string;
  name: string;
  brand: string | null;
  base_sku: string | null;
};

function margen(precio: number | null, costo: number | null): string {
  if (precio == null || costo == null || costo <= 0) return "—";
  return `${Math.round(((precio - costo) / costo) * 100)}%`;
}

export function SupplierProducts({
  slug,
  supplierId,
  productos,
  puedeEditar,
}: {
  slug: string;
  supplierId: string;
  productos: FilaProducto[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [agregando, setAgregando] = useState(false);
  const [q, setQ] = useState("");
  const [sug, setSug] = useState<Sugerencia[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [primary, setPrimary] = useState(true);
  const [buscando, startBuscar] = useTransition();
  const [guardando, setGuardando] = useState(false);

  const elegidos = Object.keys(sel).filter((k) => sel[k]);

  const buscar = (texto: string) => {
    setQ(texto);
    if (texto.trim().length < 2) {
      setSug([]);
      return;
    }
    startBuscar(async () => {
      setSug(await buscarProductosProveedor(slug, supplierId, texto));
    });
  };

  async function confirmarAgregar() {
    setGuardando(true);
    const r = await agregarProductosAProveedor(slug, supplierId, elegidos, primary);
    setGuardando(false);
    if (notificar(r)) {
      setAgregando(false);
      setQ("");
      setSug([]);
      setSel({});
      router.refresh();
    }
  }

  async function accion(fn: () => Promise<{ ok: boolean; message: string }>) {
    if (notificar(await fn())) router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Productos de este proveedor ({productos.length})</CardTitle>
        <div className="flex items-center gap-2">
          <Link
            href={`/panel/${slug}/productos?proveedor=${supplierId}`}
            className="inline-flex items-center gap-1.5 rounded-comp-sm border border-linea-fuerte bg-superficie px-2.5 py-1.5 text-xs text-texto hover:bg-superficie-sec"
          >
            <ExternalLink size={13} />
            Ver / repreciar en Productos
          </Link>
          {puedeEditar && (
            <Button tamano="sm" onClick={() => setAgregando((v) => !v)}>
              <Plus size={14} />
              Agregar productos
            </Button>
          )}
        </div>
      </CardHeader>

      <CardBody className="space-y-3">
        {agregando && (
          <div className="space-y-2 rounded-comp-sm border border-linea bg-superficie-sec p-3">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-tenue"
              />
              <Input
                autoFocus
                value={q}
                onChange={(e) => buscar(e.target.value)}
                placeholder="Buscar producto por nombre, SKU o marca…"
                className="pl-8"
              />
            </div>
            {q.trim().length >= 2 && (
              <div className="max-h-56 overflow-y-auto rounded-comp-sm border border-linea bg-superficie">
                {buscando && sug.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-texto-tenue">Buscando…</p>
                ) : sug.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-texto-tenue">
                    Sin resultados nuevos.
                  </p>
                ) : (
                  sug.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        setSel((m) => ({ ...m, [s.id]: !m[s.id] }))
                      }
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-superficie-sec"
                    >
                      <span
                        className={`flex size-4 items-center justify-center rounded border ${
                          sel[s.id]
                            ? "border-primario bg-primario text-white"
                            : "border-linea-fuerte"
                        }`}
                      >
                        {sel[s.id] && <Check size={11} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-texto">
                        {s.name}
                      </span>
                      <span className="shrink-0 text-xs text-texto-tenue">
                        {s.brand ?? s.base_sku ?? ""}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-texto-sec">
                <input
                  type="checkbox"
                  checked={primary}
                  onChange={(e) => setPrimary(e.target.checked)}
                />
                Marcar como proveedor principal
              </label>
              <Button
                tamano="sm"
                onClick={confirmarAgregar}
                disabled={elegidos.length === 0 || guardando}
                className="ml-auto"
              >
                Vincular {elegidos.length > 0 ? `(${elegidos.length})` : ""}
              </Button>
            </div>
          </div>
        )}

        {productos.length === 0 ? (
          <p className="text-sm text-texto-tenue">
            Este proveedor todavía no tiene productos vinculados.
          </p>
        ) : (
          <div className="tabla-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-linea text-left text-[11px] uppercase tracking-wide text-texto-sec">
                  <th className="py-2 pr-2">Producto</th>
                  <th className="py-2 pr-2 text-right">Costo prov.</th>
                  <th className="py-2 pr-2 text-right">Precio venta</th>
                  <th className="py-2 pr-2 text-right">Margen</th>
                  <th className="py-2 pr-2"></th>
                  {puedeEditar && <th className="w-16 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => (
                  <tr
                    key={p.product_id}
                    className={`border-b border-linea ${p.is_deleted ? "opacity-50" : ""}`}
                  >
                    <td className="py-1.5 pr-2">
                      <Link
                        href={`/panel/${slug}/productos/${p.product_id}`}
                        className="font-medium text-texto hover:text-primario"
                      >
                        {p.name}
                      </Link>
                      <div className="text-xs text-texto-tenue">
                        {p.supplier_sku ? `cód. ${p.supplier_sku} · ` : ""}
                        {p.brand ?? ""}
                      </div>
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-texto-sec">
                      {p.cost != null ? formatearMoneda(p.cost) : "—"}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {p.min_price != null ? formatearMoneda(p.min_price) : "—"}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-texto-sec">
                      {margen(p.min_price, p.cost)}
                    </td>
                    <td className="py-1.5 pr-2">
                      {p.is_primary && <Badge tono="primario">Principal</Badge>}
                    </td>
                    {puedeEditar && (
                      <td className="py-1.5">
                        <span className="flex items-center justify-end gap-1">
                          {!p.is_primary && (
                            <button
                              type="button"
                              title="Marcar como principal"
                              onClick={() =>
                                accion(() =>
                                  vincularProveedor(slug, p.product_id, {
                                    supplierId,
                                    supplierSku: p.supplier_sku,
                                    cost: p.cost,
                                    isPrimary: true,
                                  }),
                                )
                              }
                              className="rounded-comp-sm p-1 text-texto-sec hover:bg-superficie-sec"
                            >
                              <Star size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Quitar del proveedor"
                            onClick={() =>
                              accion(() =>
                                desvincularProveedor(slug, p.product_id, supplierId),
                              )
                            }
                            className="rounded-comp-sm p-1 text-texto-sec hover:bg-error-suave hover:text-error"
                          >
                            <Trash2 size={14} />
                          </button>
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
