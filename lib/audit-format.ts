import { formatearMoneda, formatearNumero } from "@/lib/format";
import { ETIQUETA_ESTADO, ETIQUETA_UNIDAD } from "@/lib/constants";
import {
  ETIQUETA_CANAL,
  ETIQUETA_CONDICION_PAGO,
  ETIQUETA_ESTADO_PEDIDO,
  ETIQUETA_ORIGEN_PRECIO,
  type CanalPedido,
  type CondicionPago,
  type EstadoPedido,
} from "@/lib/ventas";

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
  kind: "Tipo",
  amount: "Importe",
  due_date: "Fecha de cobro",
  reason: "Motivo",
  number: "N° de pedido",
  channel: "Canal",
  payment_terms: "Condición de pago",
  total: "Total",
  quantity: "Cantidad",
  unit_price: "Precio unitario",
  list_price: "Precio de lista",
  price_source: "Origen del precio",
  price_reason: "Motivo del precio",
  save_special: "Precio fijo para el cliente",
  line_total: "Subtotal",
  cancel_reason: "Motivo de cancelación",
  confirmed_at: "Confirmado",
  delivered_at: "Entregado",
  cancelled_at: "Cancelado",
  contact_name: "Contacto",
  contact_phone: "Teléfono de contacto",
  delivery_address: "Dirección de entrega",
  order_id: "Pedido",
  opening_amount: "Efectivo inicial",
  expected_cash: "Efectivo esperado",
  counted_cash: "Efectivo contado",
  difference: "Diferencia de arqueo",
  closing_note: "Nota de cierre",
  closed_at: "Cerrada",
  void_reason: "Motivo de anulación",
  voided_at: "Anulado",
  emailed_at: "Enviado por mail",
  paid_total: "Cobrado",
  collect_on_delivery: "Cobrar al entregar",
  receipt_id: "Recibo",
  session_id: "Caja",
  ends_on: "Vence",
  customer_id: "Cliente",
  balance: "Saldo",
  next_due_date: "Próximo vencimiento",
  assigned_seller: "Vendedor asignado",
  credit_limit: "Límite de cuenta corriente",
  doc_type: "Tipo de documento",
  doc_number: "Número de documento",
  email: "Email",
  phone: "Teléfono",
  address: "Dirección",
  city: "Ciudad",
  province: "Provincia",
  notes: "Notas",
  supplier_sku: "Código del proveedor",
  cost: "Costo",
  lead_time_days: "Días de entrega",
  discount_type: "Tipo de descuento",
  discount_value: "Descuento",
  title: "Título",
  subtitle: "Subtítulo",
  link: "Link",
  starts_at: "Vigente desde",
  ends_at: "Vigente hasta",
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
  if (["price", "amount", "balance", "credit_limit", "cost", "discount_value", "total", "unit_price", "list_price", "line_total", "unit_cost", "opening_amount", "expected_cash", "counted_cash", "difference", "paid_total"].includes(field) )
    return field === "discount_value" ? formatearNumero(Number(v)) : formatearMoneda(Number(v));
  if (["stock", "min_stock", "size_value", "sort_order", "position"].includes(field))
    return formatearNumero(Number(v));
  if (field === "kind") {
    return (
      {
        cargo: "Cargo (venta / factura)",
        pago: "Pago recibido",
        nota_credito: "Nota de crédito",
        nota_debito: "Nota de débito",
        ajuste: "Ajuste manual",
      }[String(v)] ?? String(v)
    );
  }
  if (field === "assigned_seller") return "otro vendedor";
  if (field === "status")
    return (
      ETIQUETA_ESTADO[v as "active" | "inactive"] ??
      ETIQUETA_ESTADO_PEDIDO[v as EstadoPedido] ??
      String(v)
    );
  if (field === "payment_terms")
    return ETIQUETA_CONDICION_PAGO[v as CondicionPago] ?? String(v);
  if (field === "channel") return ETIQUETA_CANAL[v as CanalPedido] ?? String(v);
  if (field === "price_source") return ETIQUETA_ORIGEN_PRECIO[String(v)] ?? String(v);
  if (field === "order_id") return "un pedido";
  if (field === "session_id") return "una caja";
  if (field === "receipt_id") return "un recibo";
  if (field === "size_unit")
    return ETIQUETA_UNIDAD[v as keyof typeof ETIQUETA_UNIDAD] ?? String(v);
  if (["primary_category_id", "parent_id", "category_id"].includes(field))
    return maps?.categorias?.get(String(v)) ?? "otra categoría";
  if (field === "price_tier_id")
    return maps?.tiers?.get(String(v)) ?? "otro nivel";
  if (field === "variant_id") return "otra presentación";
  if (field === "customer_id") return "otro cliente";
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
