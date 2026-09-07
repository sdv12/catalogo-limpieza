"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";
import {
  TIPOS_DOC,
  CONDICIONES_IVA,
  ETIQUETA_CONDICION_IVA,
  PROVINCIAS_AR,
} from "@/lib/constants";
import { parsearNumero, type CustomerInput } from "@/lib/validation/customer";
import { formatearMoneda } from "@/lib/format";
import {
  crearCliente,
  actualizarCliente,
} from "@/app/panel/[catalogo]/clientes/actions";

export type ClienteExistente = {
  id: string;
  name: string;
  doc_type: string | null;
  doc_number: string | null;
  tax_condition: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  price_tier_id: string | null;
  credit_limit: number;
  notes: string | null;
  is_active: boolean;
};

type Tier = { id: string; name: string };

export function CustomerForm({
  slug,
  tiers,
  cliente,
}: {
  slug: string;
  tiers: Tier[];
  cliente?: ClienteExistente;
}) {
  const router = useRouter();
  const edicion = !!cliente;

  const [f, setF] = useState({
    name: cliente?.name ?? "",
    doc_type: cliente?.doc_type ?? "",
    doc_number: cliente?.doc_number ?? "",
    tax_condition: cliente?.tax_condition ?? "consumidor_final",
    email: cliente?.email ?? "",
    phone: cliente?.phone ?? "",
    address: cliente?.address ?? "",
    city: cliente?.city ?? "",
    province: cliente?.province ?? "",
    price_tier_id: cliente?.price_tier_id ?? "",
    credit_limit: cliente?.credit_limit != null ? String(cliente.credit_limit) : "0",
    notes: cliente?.notes ?? "",
    is_active: cliente?.is_active ?? true,
  });
  const set = (k: keyof typeof f, v: string | boolean) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    if (f.name.trim().length < 2) {
      setError("El nombre es obligatorio.");
      return;
    }
    setError(null);
    setGuardando(true);

    const input: CustomerInput = {
      name: f.name.trim(),
      doc_type: (f.doc_type || null) as CustomerInput["doc_type"],
      doc_number: f.doc_number.trim() || null,
      tax_condition: f.tax_condition as CustomerInput["tax_condition"],
      email: f.email.trim() || null,
      phone: f.phone.trim() || null,
      address: f.address.trim() || null,
      city: f.city.trim() || null,
      province: f.province.trim() || null,
      price_tier_id: f.price_tier_id || null,
      credit_limit: parsearNumero(f.credit_limit) ?? 0,
      notes: f.notes.trim() || null,
      is_active: f.is_active,
    };

    const r = edicion
      ? await actualizarCliente(slug, cliente!.id, input)
      : await crearCliente(slug, input);
    setGuardando(false);

    if (r.ok) {
      toast.success(r.message);
      router.push(`/panel/${slug}/clientes`);
      router.refresh();
    } else {
      setError(r.message);
      toast.error(r.message);
    }
  }

  return (
    <div className="space-y-5 pb-24">
      {error && (
        <div className="rounded-comp border border-error bg-error-suave px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Datos del cliente</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <Label requerido>Nombre / Razón social</Label>
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Tipo de documento</Label>
              <Select
                value={f.doc_type}
                onChange={(e) => set("doc_type", e.target.value)}
              >
                <option value="">—</option>
                {TIPOS_DOC.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Número</Label>
              <Input
                value={f.doc_number}
                onChange={(e) => set("doc_number", e.target.value)}
              />
            </div>
            <div>
              <Label>Condición IVA</Label>
              <Select
                value={f.tax_condition}
                onChange={(e) => set("tax_condition", e.target.value)}
              >
                {CONDICIONES_IVA.map((c) => (
                  <option key={c} value={c}>
                    {ETIQUETA_CONDICION_IVA[c]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={f.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                value={f.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Dirección</Label>
              <Input
                value={f.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Ciudad</Label>
                <Input
                  value={f.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </div>
              <div>
                <Label>Provincia</Label>
                <Select
                  value={f.province}
                  onChange={(e) => set("province", e.target.value)}
                >
                  <option value="">—</option>
                  {PROVINCIAS_AR.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comercial</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nivel de precio por defecto</Label>
              <Select
                value={f.price_tier_id}
                onChange={(e) => set("price_tier_id", e.target.value)}
              >
                <option value="">Sin definir</option>
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Límite de cuenta corriente</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={f.credit_limit}
                onChange={(e) => set("credit_limit", e.target.value)}
              />
              <p className="mt-1 text-xs text-texto-tenue">
                {formatearMoneda(parsearNumero(f.credit_limit) ?? 0)}
              </p>
            </div>
          </div>

          <div>
            <Label>Notas</Label>
            <Textarea
              value={f.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-texto-sec">
            <input
              type="checkbox"
              checked={f.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
            />
            Cliente activo
          </label>
        </CardBody>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-linea bg-superficie/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-2">
          <Button
            variante="secundario"
            onClick={() => router.push(`/panel/${slug}/clientes`)}
            disabled={guardando}
          >
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={guardando}>
            {guardando
              ? "Guardando…"
              : edicion
                ? "Guardar cambios"
                : "Crear cliente"}
          </Button>
        </div>
      </div>
    </div>
  );
}
