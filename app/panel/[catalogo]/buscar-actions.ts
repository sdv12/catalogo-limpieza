"use server";

import { resolverCatalogo } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { sanitizarBusqueda } from "@/lib/format";

export type ResultadosBusqueda = {
  productos: { id: string; name: string; base_sku: string | null }[];
  clientes: { id: string; name: string }[];
  proveedores: { id: string; name: string }[];
};

const vacio: ResultadosBusqueda = {
  productos: [],
  clientes: [],
  proveedores: [],
};

export async function buscarGlobal(
  slug: string,
  q: string,
): Promise<ResultadosBusqueda> {
  const t = sanitizarBusqueda(q);
  if (t.length < 2) return vacio;

  const catalogo = await resolverCatalogo(slug);
  const supabase = await createClient();

  const [prods, clis, provs] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, base_sku")
      .eq("catalog_id", catalogo.id)
      .eq("is_deleted", false)
      .or(`name.ilike.%${t}%,base_sku.ilike.%${t}%`)
      .order("name")
      .limit(6),
    supabase
      .from("customers")
      .select("id, name")
      .eq("catalog_id", catalogo.id)
      .eq("is_deleted", false)
      .ilike("name", `%${t}%`)
      .order("name")
      .limit(6),
    supabase
      .from("suppliers")
      .select("id, name")
      .eq("catalog_id", catalogo.id)
      .eq("is_deleted", false)
      .ilike("name", `%${t}%`)
      .order("name")
      .limit(6),
  ]);

  return {
    productos: prods.data ?? [],
    clientes: clis.data ?? [],
    proveedores: provs.data ?? [],
  };
}
