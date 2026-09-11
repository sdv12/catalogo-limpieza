import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type DB = SupabaseClient<Database>;

/** Categorías del catálogo como opciones con jerarquía en la etiqueta. */
export async function opcionesCategoria(supabase: DB, catalogId: string) {
  const { data } = await supabase
    .from("categories")
    .select("id, name, parent_id, is_active")
    .eq("catalog_id", catalogId)
    .order("sort_order");

  const hijos = new Map<string | null, typeof data>();
  for (const c of data ?? []) {
    const lista = hijos.get(c.parent_id) ?? [];
    lista.push(c);
    hijos.set(c.parent_id, lista);
  }
  const out: { id: string; label: string }[] = [];
  const rec = (parent: string | null, pref: string) => {
    for (const c of hijos.get(parent) ?? []) {
      out.push({ id: c.id, label: pref + c.name + (c.is_active ? "" : " (inactiva)") });
      rec(c.id, pref + "— ");
    }
  };
  rec(null, "");
  return out;
}

/** Marcas cargadas en los productos del catálogo (distintas, ordenadas). */
export async function marcasDelCatalogo(supabase: DB, catalogId: string) {
  const { data } = await supabase
    .from("products")
    .select("brand")
    .eq("catalog_id", catalogId)
    .eq("is_deleted", false)
    .not("brand", "is", null);
  const set = new Set<string>();
  for (const r of data ?? []) {
    const b = (r.brand ?? "").trim();
    if (b) set.add(b);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

/** Proveedores activos del catálogo como opciones. */
export async function proveedoresDelCatalogo(supabase: DB, catalogId: string) {
  const { data } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("catalog_id", catalogId)
    .eq("is_deleted", false)
    .order("name");
  return data ?? [];
}

/** Miembros admin/empleado del catálogo, para asignar como vendedor. */
export async function vendedoresDelCatalogo(supabase: DB, catalogId: string) {
  const { data: miembros } = await supabase
    .from("catalog_members")
    .select("user_id, role")
    .eq("catalog_id", catalogId)
    .in("role", ["admin", "empleado"]);
  const ids = (miembros ?? []).map((m) => m.user_id);
  if (ids.length === 0) return [];

  const { data: perfiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids);

  return (perfiles ?? [])
    .map((p) => ({ id: p.id, label: p.full_name || p.email || "Usuario" }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

/** Niveles de precio activos del catálogo, ordenados. */
export async function tiersDelCatalogo(supabase: DB, catalogId: string) {
  const { data } = await supabase
    .from("price_tiers")
    .select("id, name, code, is_active")
    .eq("catalog_id", catalogId)
    .order("sort_order");
  return (data ?? []).filter((t) => t.is_active);
}

/** Mapas id → nombre para resolver referencias en los diffs de auditoría. */
export async function mapasAuditoria(supabase: DB, catalogId: string) {
  const [{ data: cats }, { data: tiers }] = await Promise.all([
    supabase.from("categories").select("id, name").eq("catalog_id", catalogId),
    supabase.from("price_tiers").select("id, name").eq("catalog_id", catalogId),
  ]);
  return {
    categorias: new Map((cats ?? []).map((c) => [c.id, c.name])),
    tiers: new Map((tiers ?? []).map((t) => [t.id, t.name])),
  };
}
