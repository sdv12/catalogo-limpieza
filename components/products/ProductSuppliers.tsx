"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Trash2, Plus } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { notificar } from "@/lib/ui";
import { formatearMoneda } from "@/lib/format";
import { parsearNumero } from "@/lib/validation/product";
import {
  vincularProveedor,
  desvincularProveedor,
} from "@/app/panel/[catalogo]/proveedores/actions";

type Vinculo = {
  supplier_id: string;
  supplier_name: string;
  supplier_sku: string | null;
  cost: number | null;
  lead_time_days: number | null;
  is_primary: boolean;
};

export function ProductSuppliers({
  slug,
  productId,
  vinculos,
  proveedores,
}: {
  slug: string;
  productId: string;
  vinculos: Vinculo[];
  proveedores: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [sku, setSku] = useState("");
  const [cost, setCost] = useState("");
  const [primary, setPrimary] = useState(vinculos.length === 0);
  const [guardando, setGuardando] = useState(false);

  const disponibles = proveedores.filter(
    (p) => !vinculos.some((v) => v.supplier_id === p.id),
  );

  async function vincular() {
    if (!supplierId) return;
    setGuardando(true);
    const r = await vincularProveedor(slug, productId, {
      supplierId,
      supplierSku: sku || null,
      cost: parsearNumero(cost),
      isPrimary: primary,
    });
    setGuardando(false);
    if (notificar(r)) {
      setSupplierId("");
      setSku("");
      setCost("");
      setPrimary(false);
      router.refresh();
    }
  }

  async function accion(fn: () => Promise<{ ok: boolean; message: string }>) {
    if (notificar(await fn())) router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proveedores del producto</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {vinculos.length === 0 ? (
          <p className="text-sm text-texto-tenue">
            Este producto no tiene proveedores asociados.
          </p>
        ) : (
          <ul className="divide-y divide-linea rounded-comp-sm border border-linea">
            {vinculos.map((v) => (
              <li
                key={v.supplier_id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
              >
                <span className="font-medium text-texto">{v.supplier_name}</span>
                {v.is_primary && <Badge tono="primario">Principal</Badge>}
                {v.supplier_sku && (
                  <span className="text-xs text-texto-tenue">
                    cód. {v.supplier_sku}
                  </span>
                )}
                {v.cost != null && (
                  <span className="text-xs text-texto-sec">
                    costo {formatearMoneda(v.cost)}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1">
                  {!v.is_primary && (
                    <button
                      type="button"
                      title="Marcar como principal"
                      onClick={() =>
                        accion(() =>
                          vincularProveedor(slug, productId, {
                            supplierId: v.supplier_id,
                            supplierSku: v.supplier_sku,
                            cost: v.cost,
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
                    onClick={() =>
                      accion(() =>
                        desvincularProveedor(slug, productId, v.supplier_id),
                      )
                    }
                    className="rounded-comp-sm p-1 text-texto-sec hover:bg-error-suave hover:text-error"
                    aria-label="Quitar"
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {disponibles.length > 0 && (
          <div className="flex flex-wrap items-end gap-2 rounded-comp-sm border border-linea bg-superficie-sec p-3">
            <div className="min-w-40 flex-1">
              <span className="mb-0.5 block text-xs text-texto-sec">
                Proveedor
              </span>
              <Select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">Elegí…</option>
                {disponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-28">
              <span className="mb-0.5 block text-xs text-texto-sec">
                Cód. prov.
              </span>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div className="w-28">
              <span className="mb-0.5 block text-xs text-texto-sec">Costo</span>
              <Input
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <label className="flex h-10 items-center gap-1.5 text-xs text-texto-sec">
              <input
                type="checkbox"
                checked={primary}
                onChange={(e) => setPrimary(e.target.checked)}
              />
              Principal
            </label>
            <Button onClick={vincular} disabled={!supplierId || guardando}>
              <Plus size={15} />
              Vincular
            </Button>
          </div>
        )}
        {proveedores.length === 0 && (
          <p className="text-xs text-texto-tenue">
            Cargá proveedores en la sección Proveedores para poder asociarlos.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
