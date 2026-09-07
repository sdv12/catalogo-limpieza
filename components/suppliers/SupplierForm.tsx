"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";
import { PROVINCIAS_AR } from "@/lib/constants";
import type { SupplierInput } from "@/lib/validation/supplier";
import {
  crearProveedor,
  actualizarProveedor,
} from "@/app/panel/[catalogo]/proveedores/actions";

export type ProveedorExistente = {
  id: string;
  name: string;
  doc_type: string | null;
  doc_number: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
};

const TIPOS = ["CUIT", "CUIL", "DNI", "Otro"] as const;

export function SupplierForm({
  slug,
  proveedor,
}: {
  slug: string;
  proveedor?: ProveedorExistente;
}) {
  const router = useRouter();
  const edicion = !!proveedor;

  const [f, setF] = useState({
    name: proveedor?.name ?? "",
    doc_type: proveedor?.doc_type ?? "",
    doc_number: proveedor?.doc_number ?? "",
    contact_name: proveedor?.contact_name ?? "",
    email: proveedor?.email ?? "",
    phone: proveedor?.phone ?? "",
    address: proveedor?.address ?? "",
    city: proveedor?.city ?? "",
    province: proveedor?.province ?? "",
    payment_terms: proveedor?.payment_terms ?? "",
    notes: proveedor?.notes ?? "",
    is_active: proveedor?.is_active ?? true,
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

    const input: SupplierInput = {
      name: f.name.trim(),
      doc_type: (f.doc_type || null) as SupplierInput["doc_type"],
      doc_number: f.doc_number.trim() || null,
      contact_name: f.contact_name.trim() || null,
      email: f.email.trim() || null,
      phone: f.phone.trim() || null,
      address: f.address.trim() || null,
      city: f.city.trim() || null,
      province: f.province.trim() || null,
      payment_terms: f.payment_terms.trim() || null,
      notes: f.notes.trim() || null,
      is_active: f.is_active,
    };

    const r = edicion
      ? await actualizarProveedor(slug, proveedor!.id, input)
      : await crearProveedor(slug, input);
    setGuardando(false);

    if (r.ok) {
      toast.success(r.message);
      router.push(`/panel/${slug}/proveedores`);
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
          <CardTitle>Datos del proveedor</CardTitle>
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
                {TIPOS.map((d) => (
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
              <Label>Persona de contacto</Label>
              <Input
                value={f.contact_name}
                onChange={(e) => set("contact_name", e.target.value)}
              />
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

          <div>
            <Label>Condición de pago</Label>
            <Input
              value={f.payment_terms}
              onChange={(e) => set("payment_terms", e.target.value)}
              placeholder="Contado, 30 días, 30/60/90…"
            />
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
            Proveedor activo
          </label>
        </CardBody>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-linea bg-superficie/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-2">
          <Button
            variante="secundario"
            onClick={() => router.push(`/panel/${slug}/proveedores`)}
            disabled={guardando}
          >
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={guardando}>
            {guardando
              ? "Guardando…"
              : edicion
                ? "Guardar cambios"
                : "Crear proveedor"}
          </Button>
        </div>
      </div>
    </div>
  );
}
