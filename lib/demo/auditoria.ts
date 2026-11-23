import { tabla } from "@/lib/demo/store";

type Fila = Record<string, unknown>;

/** Tabla → entity_type del audit_log (como los triggers fn_audit). */
const ENTIDAD: Record<string, string> = {
  products: "product",
  product_variants: "variant",
  variant_prices: "price",
  categories: "category",
  product_images: "image",
  catalogs: "catalog",
  catalog_members: "member",
  customers: "customer",
  suppliers: "supplier",
  product_suppliers: "product_supplier",
  promotions: "promotion",
  customer_transactions: "customer_transaction",
  customer_prices: "customer_price",
  orders: "order",
  order_items: "order_item",
  channel_keys: "channel_key",
  cash_sessions: "cash_session",
  receipts: "receipt",
  cash_movements: "cash_movement",
};

const IGNORAR = new Set(["id", "catalog_id", "created_at", "updated_at", "created_by", "updated_by", "user_id"]);

export type Actor = { uid: string | null; email: string | null };

export function auditar(
  actor: Actor,
  nombreTabla: string,
  antes: Fila | null,
  despues: Fila | null,
  accion?: string,
  motivo?: string,
) {
  const entidad = ENTIDAD[nombreTabla];
  if (!entidad || !actor.uid) return;
  const a = antes ?? {};
  const d = despues ?? {};
  const changes: { field: string; old: unknown; new: unknown }[] = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(d)])) {
    if (IGNORAR.has(k)) continue;
    if (JSON.stringify(a[k] ?? null) !== JSON.stringify(d[k] ?? null)) {
      changes.push({ field: k, old: antes ? (a[k] ?? null) : null, new: despues ? (d[k] ?? null) : null });
    }
  }
  if (antes && despues && changes.length === 0 && !accion) return;

  let action = accion;
  if (!action) {
    if (!antes) action = "create";
    else if (!despues) action = "delete";
    else if (a.is_deleted === false && d.is_deleted === true) action = "delete";
    else if (a.is_deleted === true && d.is_deleted === false) action = "restore";
    else action = "update";
  }

  const fila = despues ?? antes!;
  const catalogo = nombreTabla === "catalogs" ? fila.id : fila.catalog_id;
  let productId: unknown = null;
  if (entidad === "product") productId = fila.id;
  else if (entidad === "variant" || entidad === "image") productId = fila.product_id;
  else if (entidad === "price") {
    productId = tabla("product_variants").find((v) => v.id === fila.variant_id)?.product_id ?? null;
  }

  tabla("audit_log").push({
    id: crypto.randomUUID(),
    catalog_id: catalogo,
    entity_type: entidad,
    entity_id: entidad === "member" ? fila.user_id : fila.id,
    product_id: productId,
    action,
    changes,
    summary: motivo ? `Motivo: ${motivo}` : null,
    batch_id: null,
    actor_id: actor.uid,
    actor_email: actor.email,
    created_at: new Date().toISOString(),
  });
}
