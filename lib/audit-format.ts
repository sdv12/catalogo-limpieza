import { formatearMoneda, formatearNumero } from "@/lib/format";
import { ETIQUETA_ESTADO, ETIQUETA_UNIDAD } from "@/lib/constants";

export type CambioCampo = { field: string; old: unknown; new: unknown };

export type MapasAuditoria = {
  categorias?: Map<string, string>;
  tiers?: Map<string, string>;
};

export const ETIQUETA_CAMPO: Record<string, string> = {
  name: "Nombre",
  description: "Descripción",
  brand: "Marca",
  base_sku: "SKU base",
  sku: "SKU",
  status: "Estado",
  is_active: "Activo",
  is_deleted: "Dado de baja",
  primary_category_id: "Categoría principal",
  parent_id: "Categoría padre",
  category_id: "Categoría",
  is_primary: "Categoría principal",
  price: "Precio",
  currency: "Moneda",
  stock: "Stock",
  min_stock: "Stock mínimo",
  size_value: "Tamaño",
  size_unit: "Unidad",
  barcode: "Código de barras",
  position: "Orden",
  sort_order: "Orden",
  slug: "Identificador (slug)",
  role: "Rol",
  logo_path: "Logo",
  price_tier_id: "Nivel de precio",
  variant_id: "Presentación",
  alt: "Texto alternativo",
  storage_path: "Archivo",
};

const CAMPOS_OCULTOS = new Set([
  "attributes",
  "updated_by",
  "created_by",
  "deleted_by",
  "deleted_at",
  "id",
  "catalog_id",
  "product_id",
  "user_id",
]);

function vacio(v: unknown) {
  return v == null || v === false || v === 0 || v === "" || v === "{}";
}

/** Oculta campos internos y ruido (null → null/false/0 en las altas). */
export function campoVisible(c: CambioCampo): boolean {
  if (CAMPOS_OCULTOS.has(c.field)) return false;
  if (vacio(c.old) && vacio(c.new)) return false;
  return true;
}

export function formatearValorAuditoria(
  field: string,
  v: unknown,
  maps?: MapasAuditoria,
): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (field === "price") return formatearMoneda(Number(v));
  if (["stock", "min_stock", "size_value", "sort_order", "position"].includes(field))
    return formatearNumero(Number(v));
  if (field === "status")
    return ETIQUETA_ESTADO[v as "active" | "inactive"] ?? String(v);
  if (field === "size_unit")
    return ETIQUETA_UNIDAD[v as keyof typeof ETIQUETA_UNIDAD] ?? String(v);
  if (["primary_category_id", "parent_id", "category_id"].includes(field))
    return maps?.categorias?.get(String(v)) ?? "otra categoría";
  if (field === "price_tier_id")
    return maps?.tiers?.get(String(v)) ?? "otro nivel";
  if (field === "variant_id") return "otra presentación";
  if (field === "role") {
    return (
      { admin: "Administrador", empleado: "Empleado", viewer: "Solo lectura" }[
        String(v)
      ] ?? String(v)
    );
  }
  if (field === "tax_condition") {
    return (
      {
        responsable_inscripto: "Responsable inscripto",
        monotributo: "Monotributo",
        consumidor_final: "Consumidor final",
        exento: "Exento",
        no_categorizado: "No categorizado",
      }[String(v)] ?? String(v)
    );
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Normaliza el jsonb `changes` a un array tipado. */
export function parsearCambios(changes: unknown): CambioCampo[] {
  if (!Array.isArray(changes)) return [];
  return changes.filter(
    (c): c is CambioCampo =>
      !!c && typeof c === "object" && "field" in c,
  );
}
