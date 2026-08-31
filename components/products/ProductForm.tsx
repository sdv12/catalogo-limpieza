"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Package } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Input,
  Label,
  Select,
  Textarea,
  FieldError,
  FieldHint,
} from "@/components/ui/Field";
import { ImageUploader, type ImagenProducto } from "@/components/products/ImageUploader";
import { StockAdjustDialog } from "@/components/products/StockAdjustDialog";
import { UNIDADES_MEDIDA, ETIQUETA_UNIDAD, ESTADOS_PRODUCTO, ETIQUETA_ESTADO } from "@/lib/constants";
import { parsearNumero, type ProductoInput } from "@/lib/validation/product";
import { formatearNumero } from "@/lib/format";
import {
  crearProducto,
  actualizarProducto,
} from "@/app/panel/[catalogo]/productos/actions";

type Tier = { id: string; name: string; code: string };
type CategoriaOpt = { id: string; label: string };

type VarState = {
  key: string;
  id?: string;
  name: string;
  sku: string;
  size_value: string;
  size_unit: string;
  barcode: string;
  min_stock: string;
  stock_inicial: string;
  stock_actual?: number;
  prices: Record<string, string>;
};

export type ProductoExistente = {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  base_sku: string | null;
  primary_category_id: string;
  status: string;
  extraCategoryIds: string[];
  images: ImagenProducto[];
  variants: {
    id: string;
    name: string;
    sku: string;
    size_value: number | null;
    size_unit: string | null;
    barcode: string | null;
    stock: number;
    min_stock: number;
    prices: Record<string, number>;
  }[];
};

let contador = 0;
const nuevaKey = () => `v${++contador}`;

function varianteVacia(tiers: Tier[]): VarState {
  return {
    key: nuevaKey(),
    name: "",
    sku: "",
    size_value: "",
    size_unit: "",
    barcode: "",
    min_stock: "0",
    stock_inicial: "0",
    prices: Object.fromEntries(tiers.map((t) => [t.id, ""])),
  };
}

export function ProductForm({
  slug,
  catalogId,
  categorias,
  tiers,
  producto,
}: {
  slug: string;
  catalogId: string;
  categorias: CategoriaOpt[];
  tiers: Tier[];
  producto?: ProductoExistente;
}) {
  const router = useRouter();
  const edicion = !!producto;

  const [name, setName] = useState(producto?.name ?? "");
  const [description, setDescription] = useState(producto?.description ?? "");
  const [brand, setBrand] = useState(producto?.brand ?? "");
  const [baseSku, setBaseSku] = useState(producto?.base_sku ?? "");
  const [categoriaPrincipal, setCategoriaPrincipal] = useState(
    producto?.primary_category_id ?? categorias[0]?.id ?? "",
  );
  const [categoriasExtra, setCategoriasExtra] = useState<string[]>(
    producto?.extraCategoryIds ?? [],
  );
  const [status, setStatus] = useState(producto?.status ?? "active");
  const [images, setImages] = useState<ImagenProducto[]>(producto?.images ?? []);
  const [variants, setVariants] = useState<VarState[]>(
    producto
      ? producto.variants.map((v) => ({
          key: nuevaKey(),
          id: v.id,
          name: v.name,
          sku: v.sku,
          size_value: v.size_value?.toString() ?? "",
          size_unit: v.size_unit ?? "",
          barcode: v.barcode ?? "",
          min_stock: String(v.min_stock),
          stock_inicial: "0",
          stock_actual: v.stock,
          prices: Object.fromEntries(
            tiers.map((t) => [t.id, v.prices[t.id]?.toString() ?? ""]),
          ),
        }))
      : [varianteVacia(tiers)],
  );

  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [ajustar, setAjustar] = useState<VarState | null>(null);

  const setVar = (key: string, patch: Partial<VarState>) =>
    setVariants((vs) => vs.map((v) => (v.key === key ? { ...v, ...patch } : v)));

  function toggleExtra(id: string) {
    setCategoriasExtra((cs) =>
      cs.includes(id) ? cs.filter((c) => c !== id) : [...cs, id],
    );
  }

  async function enviar() {
    const errs: string[] = [];
    if (!name.trim()) errs.push("El nombre del producto es obligatorio.");
    if (!categoriaPrincipal) errs.push("Elegí una categoría principal.");
    variants.forEach((v, i) => {
      if (!v.name.trim()) errs.push(`Presentación ${i + 1}: falta el nombre.`);
      if (!v.sku.trim()) errs.push(`Presentación ${i + 1}: falta el SKU.`);
      const tienePrecio = Object.values(v.prices).some(
        (p) => (parsearNumero(p) ?? 0) > 0,
      );
      if (!tienePrecio)
        errs.push(`Presentación ${i + 1}: cargá al menos un precio.`);
    });
    if (errs.length) {
      setErrores(errs);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErrores([]);
    setGuardando(true);

    const input: ProductoInput = {
      name: name.trim(),
      description: description.trim() || null,
      brand: brand.trim() || null,
      base_sku: baseSku.trim() || null,
      primary_category_id: categoriaPrincipal,
      extra_category_ids: categoriasExtra,
      status: status as ProductoInput["status"],
      images: images.map((i) => ({ path: i.path, alt: i.alt ?? null })),
      variants: variants.map((v) => ({
        id: v.id,
        name: v.name.trim(),
        sku: v.sku.trim(),
        size_value: parsearNumero(v.size_value),
        size_unit: (v.size_unit || null) as ProductoInput["variants"][number]["size_unit"],
        barcode: v.barcode.trim() || null,
        min_stock: parsearNumero(v.min_stock) ?? 0,
        stock_inicial: edicion ? 0 : parsearNumero(v.stock_inicial) ?? 0,
        prices: v.prices,
      })),
    };

    const r = edicion
      ? await actualizarProducto(slug, producto!.id, input)
      : await crearProducto(slug, input);
    setGuardando(false);

    if (r.ok) {
      toast.success(r.message);
      const id = (r.data as { id?: string } | undefined)?.id;
      router.push(
        id ? `/panel/${slug}/productos/${id}` : `/panel/${slug}/productos`,
      );
      router.refresh();
    } else {
      setErrores([r.message]);
      toast.error(r.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <div className="space-y-5 pb-24">
      {errores.length > 0 && (
        <div className="rounded-comp border border-error bg-error-suave px-4 py-3 text-sm text-error">
          <ul className="list-inside list-disc space-y-0.5">
            {errores.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Datos del producto</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <Label htmlFor="name" requerido>
              Nombre
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Detergente líquido concentrado"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="brand">Marca</Label>
              <Input
                id="brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="baseSku">Código interno / SKU base</Label>
              <Input
                id="baseSku"
                value={baseSku}
                onChange={(e) => setBaseSku(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cat" requerido>
                Categoría principal
              </Label>
              <Select
                id="cat"
                value={categoriaPrincipal}
                onChange={(e) => setCategoriaPrincipal(e.target.value)}
              >
                <option value="">— Elegí —</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
              {categorias.length === 0 && (
                <FieldError>
                  Primero creá una categoría en la sección Categorías.
                </FieldError>
              )}
            </div>
            <div>
              <Label htmlFor="status">Estado</Label>
              <Select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {ESTADOS_PRODUCTO.map((s) => (
                  <option key={s} value={s}>
                    {ETIQUETA_ESTADO[s]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {categorias.length > 1 && (
            <div>
              <Label>Categorías adicionales (opcional)</Label>
              <div className="flex flex-wrap gap-1.5">
                {categorias
                  .filter((c) => c.id !== categoriaPrincipal)
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleExtra(c.id)}
                      className={`rounded-full border px-2.5 py-1 text-xs ${
                        categoriasExtra.includes(c.id)
                          ? "border-primario bg-primario-suave text-primario-fuerte"
                          : "border-linea text-texto-sec hover:bg-superficie-sec"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Imágenes</CardTitle>
        </CardHeader>
        <CardBody>
          <ImageUploader
            catalogId={catalogId}
            valor={images}
            onChange={setImages}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Presentaciones y precios</CardTitle>
          <Button
            tamano="sm"
            variante="secundario"
            onClick={() => setVariants((vs) => [...vs, varianteVacia(tiers)])}
          >
            <Plus size={14} />
            Agregar presentación
          </Button>
        </CardHeader>
        <CardBody className="space-y-4">
          {variants.map((v, i) => (
            <div
              key={v.key}
              className="rounded-comp border border-linea bg-superficie-sec p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-medium text-texto">
                  <Package size={15} />
                  Presentación {i + 1}
                </span>
                {variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setVariants((vs) => vs.filter((x) => x.key !== v.key))
                    }
                    className="rounded-comp-sm p-1 text-texto-sec hover:bg-error-suave hover:text-error"
                    aria-label="Quitar presentación"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="lg:col-span-2">
                  <Label requerido>Nombre</Label>
                  <Input
                    value={v.name}
                    onChange={(e) => setVar(v.key, { name: e.target.value })}
                    placeholder="Bidón 5 L"
                  />
                </div>
                <div>
                  <Label requerido>SKU</Label>
                  <Input
                    value={v.sku}
                    onChange={(e) => setVar(v.key, { sku: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Código de barras</Label>
                  <Input
                    value={v.barcode}
                    onChange={(e) => setVar(v.key, { barcode: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Tamaño</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={v.size_value}
                    onChange={(e) => setVar(v.key, { size_value: e.target.value })}
                    placeholder="5"
                  />
                </div>
                <div>
                  <Label>Unidad</Label>
                  <Select
                    value={v.size_unit}
                    onChange={(e) => setVar(v.key, { size_unit: e.target.value })}
                  >
                    <option value="">—</option>
                    {UNIDADES_MEDIDA.map((u) => (
                      <option key={u} value={u}>
                        {ETIQUETA_UNIDAD[u]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Stock mínimo</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={v.min_stock}
                    onChange={(e) => setVar(v.key, { min_stock: e.target.value })}
                  />
                </div>
                <div>
                  {edicion ? (
                    <>
                      <Label>Stock actual</Label>
                      <div className="flex items-center gap-2">
                        <span className="flex h-10 flex-1 items-center rounded-comp-sm border border-linea bg-superficie px-3 text-sm tabular-nums">
                          {formatearNumero(v.stock_actual ?? 0)}
                        </span>
                        <Button
                          tamano="sm"
                          variante="secundario"
                          onClick={() => setAjustar(v)}
                          disabled={!v.id}
                        >
                          Ajustar
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Label>Stock inicial</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={v.stock_inicial}
                        onChange={(e) =>
                          setVar(v.key, { stock_inicial: e.target.value })
                        }
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <Label>Precios por nivel</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {tiers.map((t) => (
                    <div key={t.id}>
                      <span className="mb-0.5 block text-xs text-texto-sec">
                        {t.name}
                      </span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={v.prices[t.id] ?? ""}
                        onChange={(e) =>
                          setVar(v.key, {
                            prices: { ...v.prices, [t.id]: e.target.value },
                          })
                        }
                        placeholder="0,00"
                      />
                    </div>
                  ))}
                </div>
                {tiers.length === 0 && (
                  <FieldHint>
                    Este catálogo no tiene niveles de precio configurados.
                  </FieldHint>
                )}
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-linea bg-superficie/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-end gap-2">
          <Button
            variante="secundario"
            onClick={() => router.push(`/panel/${slug}/productos`)}
            disabled={guardando}
          >
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={guardando}>
            {guardando
              ? "Guardando…"
              : edicion
                ? "Guardar cambios"
                : "Crear producto"}
          </Button>
        </div>
      </div>

      {ajustar && ajustar.id && (
        <StockAdjustDialog
          slug={slug}
          abierto={!!ajustar}
          onCerrar={() => setAjustar(null)}
          variante={{
            id: ajustar.id,
            name: ajustar.name || "Presentación",
            stock: ajustar.stock_actual ?? 0,
          }}
        />
      )}
    </div>
  );
}
