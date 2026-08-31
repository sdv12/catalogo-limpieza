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
