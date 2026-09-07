"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  Plus,
  Play,
  Pause,
  X,
} from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { notificar } from "@/lib/ui";
import { formatearFecha } from "@/lib/format";
import { ETIQUETA_PROMO } from "@/lib/validation/promo";
import {
  buscarProductosPromo,
  crearPromo,
  actualizarPromo,
  eliminarPromo,
  togglePromo,
  moverPromo,
} from "@/app/panel/[catalogo]/promos/actions";

type Kind = "slide" | "destacado" | "oferta";

export type PromoFila = {
  id: string;
  kind: Kind;
  product_id: string;
  product_name: string;
  title: string | null;
  subtitle: string | null;
  link: string | null;
  discount_type: "percent" | "amount" | null;
  discount_value: number | null;
  position: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

const KINDS: Kind[] = ["slide", "destacado", "oferta"];
const HINT: Record<Kind, string> = {
  slide: "Aparecen en el carrusel de la portada.",
  destacado: "Aparecen en la sección de destacados.",
  oferta: "Producto en promoción con descuento % o monto.",
};

function paraInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function vigencia(p: PromoFila): { txt: string; tono: "exito" | "alerta" | "neutro" } {
  if (!p.is_active) return { txt: "Pausada", tono: "neutro" };
  const ahora = Date.now();
  if (p.starts_at && new Date(p.starts_at).getTime() > ahora)
    return { txt: `Desde ${formatearFecha(p.starts_at)}`, tono: "alerta" };
  if (p.ends_at && new Date(p.ends_at).getTime() < ahora)
    return { txt: `Venció ${formatearFecha(p.ends_at)}`, tono: "alerta" };
  return { txt: "Vigente", tono: "exito" };
}

const vacio = {
  productId: "",
  productLabel: "",
  title: "",
  subtitle: "",
  link: "",
  discountType: "percent" as "percent" | "amount",
  discountValue: "",
  startsAt: "",
  endsAt: "",
};

export function PromosManager({
  slug,
  promos,
}: {
  slug: string;
  promos: PromoFila[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("slide");
  const [form, setForm] = useState(vacio);
  const [editId, setEditId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sug, setSug] = useState<{ id: string; name: string; brand: string | null }[]>([]);
  const [buscando, startBuscar] = useTransition();
  const [guardando, setGuardando] = useState(false);
  const [aBorrar, setABorrar] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const buscar = (texto: string) => {
    setQ(texto);
    if (texto.trim().length < 2) return setSug([]);
    startBuscar(async () => setSug(await buscarProductosPromo(slug, texto)));
  };

  const resetForm = () => {
    setForm(vacio);
    setEditId(null);
    setQ("");
    setSug([]);
  };

  const editar = (p: PromoFila) => {
    setKind(p.kind);
    setEditId(p.id);
    setForm({
      productId: p.product_id,
      productLabel: p.product_name,
      title: p.title ?? "",
      subtitle: p.subtitle ?? "",
      link: p.link ?? "",
      discountType: p.discount_type ?? "percent",
      discountValue: p.discount_value != null ? String(p.discount_value) : "",
      startsAt: paraInput(p.starts_at),
      endsAt: paraInput(p.ends_at),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function guardar() {
    if (!form.productId) return notificar({ ok: false, message: "Elegí un producto" });
    setGuardando(true);
    const payload = {
      kind,
      productId: form.productId,
      title: form.title,
      subtitle: form.subtitle,
      link: form.link,
      discountType: kind === "oferta" ? form.discountType : null,
      discountValue:
        kind === "oferta"
          ? Number(form.discountValue.replace(/\./g, "").replace(",", ".")) || null
          : null,
      startsAt: form.startsAt,
      endsAt: form.endsAt,
      isActive: true,
    };
    const r = editId
      ? await actualizarPromo(slug, editId, payload)
      : await crearPromo(slug, payload);
    setGuardando(false);
    if (notificar(r)) {
      resetForm();
      router.refresh();
    }
  }

  async function accion(fn: () => Promise<{ ok: boolean; message: string }>) {
    if (notificar(await fn())) router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{editId ? "Editar promo" : "Nueva promo"}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                disabled={!!editId}
                className={`rounded-full border px-3 py-1 text-xs disabled:opacity-50 ${
                  kind === k
                    ? "border-primario bg-primario-suave text-primario-fuerte"
                    : "border-linea text-texto-sec hover:bg-superficie-sec"
                }`}
              >
                {ETIQUETA_PROMO[k]}
              </button>
            ))}
          </div>
          <p className="text-xs text-texto-tenue">{HINT[kind]}</p>

          <div>
            <Label requerido>Producto</Label>
            {form.productId ? (
              <div className="flex items-center gap-2 rounded-comp-sm border border-linea bg-superficie-sec px-3 py-2 text-sm">
                <span className="flex-1 text-texto">{form.productLabel}</span>
                <button
                  type="button"
                  onClick={() => {
                    set("productId", "");
                    set("productLabel", "");
                  }}
                  className="text-texto-sec hover:text-texto"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-tenue"
                  />
                  <Input
                    value={q}
                    onChange={(e) => buscar(e.target.value)}
                    placeholder="Buscar producto…"
                    className="pl-8"
                  />
                </div>
                {q.trim().length >= 2 && (
                  <div className="mt-1 max-h-48 overflow-y-auto rounded-comp-sm border border-linea">
                    {buscando && sug.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-texto-tenue">Buscando…</p>
                    ) : sug.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-texto-tenue">Sin resultados.</p>
                    ) : (
                      sug.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            set("productId", s.id);
                            set("productLabel", s.name);
                            setQ("");
                            setSug([]);
                          }}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-superficie-sec"
                        >
                          <span className="truncate text-texto">{s.name}</span>
                          <span className="shrink-0 text-xs text-texto-tenue">
                            {s.brand ?? ""}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {kind === "oferta" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Tipo de descuento</Label>
                <Select
                  value={form.discountType}
                  onChange={(e) => set("discountType", e.target.value)}
                >
                  <option value="percent">Porcentaje %</option>
                  <option value="amount">Monto fijo</option>
                </Select>
              </div>
              <div>
                <Label requerido>
                  {form.discountType === "percent" ? "% de descuento" : "Monto de descuento"}
                </Label>
                <Input
                  inputMode="decimal"
                  value={form.discountValue}
                  onChange={(e) => set("discountValue", e.target.value)}
                  placeholder={form.discountType === "percent" ? "15" : "500"}
                />
              </div>
            </div>
          )}

          {kind === "slide" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Título (opcional)</Label>
                <Input
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Si lo dejás vacío usa el nombre del producto"
                />
              </div>
              <div>
                <Label>Subtítulo (opcional)</Label>
                <Input
                  value={form.subtitle}
                  onChange={(e) => set("subtitle", e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Link (opcional)</Label>
                <Input
                  value={form.link}
                  onChange={(e) => set("link", e.target.value)}
                  placeholder="/producto/SKU — si lo dejás vacío se arma solo"
                />
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Desde (opcional)</Label>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => set("startsAt", e.target.value)}
              />
            </div>
            <div>
              <Label>Hasta (opcional)</Label>
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => set("endsAt", e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={guardar} disabled={guardando}>
              <Plus size={15} />
              {editId ? "Guardar cambios" : "Crear promo"}
            </Button>
            {editId && (
              <Button variante="secundario" onClick={resetForm}>
                Cancelar
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {KINDS.map((k) => {
        const filas = promos.filter((p) => p.kind === k);
        return (
          <Card key={k}>
            <CardHeader>
              <CardTitle>
                {ETIQUETA_PROMO[k]} ({filas.length})
              </CardTitle>
            </CardHeader>
            <CardBody>
              {filas.length === 0 ? (
                <p className="text-sm text-texto-tenue">Nada configurado todavía.</p>
              ) : (
                <ul className="divide-y divide-linea">
                  {filas.map((p, idx) => {
                    const v = vigencia(p);
                    return (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
                      >
                        <span className="flex flex-col">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => accion(() => moverPromo(slug, p.id, "subir"))}
                            className="text-texto-tenue hover:text-texto disabled:opacity-30"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === filas.length - 1}
                            onClick={() => accion(() => moverPromo(slug, p.id, "bajar"))}
                            className="text-texto-tenue hover:text-texto disabled:opacity-30"
                          >
                            <ChevronDown size={14} />
                          </button>
                        </span>
                        <span className="w-5 text-center text-xs font-semibold text-texto-tenue tabular-nums">
                          {p.position}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-texto">
                            {p.title || p.product_name}
                          </span>
                          {p.kind === "oferta" && p.discount_value != null && (
                            <span className="ml-2 text-xs text-primario-fuerte">
                              -{p.discount_value}
                              {p.discount_type === "percent" ? "%" : " $"}
                            </span>
                          )}
                          <span className="block text-xs text-texto-tenue">
                            {p.product_name}
                          </span>
                        </span>
                        <Badge tono={v.tono}>{v.txt}</Badge>
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            title={p.is_active ? "Pausar" : "Activar (orden 1)"}
                            onClick={() =>
                              accion(() => togglePromo(slug, p.id, !p.is_active))
                            }
                            className="rounded-comp-sm p-1 text-texto-sec hover:bg-superficie-sec"
                          >
                            {p.is_active ? <Pause size={14} /> : <Play size={14} />}
                          </button>
                          <button
                            type="button"
                            title="Editar"
                            onClick={() => editar(p)}
                            className="rounded-comp-sm p-1 text-texto-sec hover:bg-superficie-sec"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            title="Eliminar"
                            onClick={() => setABorrar(p.id)}
                            className="rounded-comp-sm p-1 text-texto-sec hover:bg-error-suave hover:text-error"
                          >
                            <Trash2 size={14} />
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        );
      })}

      <ConfirmDialog
        abierto={!!aBorrar}
        onCerrar={() => setABorrar(null)}
        titulo="Eliminar promo"
        mensaje="¿Eliminar esta promo? No afecta al producto."
        textoConfirmar="Eliminar"
        onConfirmar={async () => {
          if (aBorrar) await accion(() => eliminarPromo(slug, aBorrar));
          setABorrar(null);
        }}
      />
    </div>
  );
}
