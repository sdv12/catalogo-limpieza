import { z } from "zod";
import { UNIDADES_MEDIDA, ESTADOS_PRODUCTO } from "@/lib/constants";

const optStr = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : v),
  z.string().trim().nullable(),
);

/** Convierte "1.234,50" / "1234.5" / "" a número o null. */
export function parsearNumero(raw: unknown): number | null {
  if (raw === "" || raw == null) return null;
  const s = String(raw).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s.includes(".") ? s : String(raw).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export const varianteSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Nombre de la presentación obligatorio"),
  sku: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string()),
  size_value: z.number().positive("Debe ser mayor a 0").nullable().default(null),
  size_unit: z.enum(UNIDADES_MEDIDA).nullable().default(null),
  barcode: optStr,
  cost: z
    .preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.number().min(0).nullable(),
    )
    .default(null),
  min_stock: z.number().min(0).default(0),
  stock_inicial: z.number().default(0),
  /** { [price_tier_id]: "monto como texto" } */
  prices: z.record(z.string().uuid(), z.string()),
});

export const productoSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  description: optStr,
  brand: optStr,
  base_sku: optStr,
  primary_category_id: z.string().uuid("Elegí una categoría"),
  extra_category_ids: z.array(z.string().uuid()).default([]),
  status: z.enum(ESTADOS_PRODUCTO).default("active"),
  images: z
    .array(z.object({ path: z.string().min(1), alt: z.string().nullable().optional() }))
    .default([]),
  variants: z.array(varianteSchema).min(1, "Agregá al menos una presentación"),
});

export type ProductoInput = z.infer<typeof productoSchema>;
export type VarianteInput = z.infer<typeof varianteSchema>;

/** SKU automático cuando el usuario lo deja en blanco. Único por catálogo. */
export function generarSkuVariante(
  baseSku: string | null | undefined,
  nombreProducto: string,
  nombreVariante: string,
): string {
  const raiz = (baseSku || nombreProducto || "prod")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 20);
  const suf = Math.random().toString(36).slice(2, 6).toUpperCase();
  const pres = nombreVariante
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 6);
  return [raiz || "PROD", pres, suf].filter(Boolean).join("-");
}

/** Precios válidos (> 0) de una variante: [{tierId, price}]. */
export function preciosValidos(
  prices: Record<string, string>,
): { tierId: string; price: number }[] {
  return Object.entries(prices)
    .map(([tierId, raw]) => ({ tierId, price: parsearNumero(raw) ?? 0 }))
    .filter((p) => p.price > 0);
}

/** Cada variante debe tener al menos un precio > 0. */
export function validarPreciosMinimos(input: ProductoInput): string | null {
  for (const v of input.variants) {
    if (preciosValidos(v.prices).length === 0) {
      return `La presentación "${v.name || "sin nombre"}" necesita al menos un precio.`;
    }
  }
  return null;
}
