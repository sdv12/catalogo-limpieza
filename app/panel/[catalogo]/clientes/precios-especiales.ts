"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirPermiso, type ResultadoAccion } from "@/lib/guards";
import { esAdminCatalogo } from "@/lib/roles";
import { sanitizarBusqueda } from "@/lib/format";
import {
  precioEspecialSchema,
  type PrecioEspecialInput,
} from "@/lib/validation/precio-especial";

export type VarianteParaPrecio = {
  variantId: string;
  producto: string;
  presentacion: string;
  sku: string;
  /** Precio general que le corresponde al cliente (su nivel o el general). */
  precioGeneral: number | null;
  /** Costo solo si el usuario puede verlo; si no, null. */
  costo: number | null;
};

/** Nivel de precio que se usa de referencia para el cliente. */
async function tierDelCliente(
  supabase: Awaited<ReturnType<typeof createClient>>,
  catalogId: string,
  customerId: string,
): Promise<string | null> {
  const { data: cli } = await supabase
    .from("customers")
    .select("price_tier_id")
    .eq("id", customerId)
    .eq("catalog_id", catalogId)
    .maybeSingle();
  if (cli?.price_tier_id) return cli.price_tier_id;
  const { data: def } = await supabase
    .from("price_tiers")
    .select("id")
    .eq("catalog_id", catalogId)
    .eq("is_default", true)
    .maybeSingle();
  return def?.id ?? null;
}

export async function buscarVariantesParaPrecio(
  slug: string,
  customerId: string,
  q: string,
): Promise<VarianteParaPrecio[]> {
  const catalogo = await exigirPermiso(slug, "precios_especiales");
  const t = sanitizarBusqueda(q);
  if (t.length < 2) return [];
  const supabase = await createClient();
  const tierId = await tierDelCliente(supabase, catalogo.id, customerId);

  // 1) productos que matchean por nombre, SKU base o marca
  const { data: productos } = await supabase
    .from("products")
    .select("id")
    .eq("catalog_id", catalogo.id)
    .eq("is_deleted", false)
    .or(`name.ilike.%${t}%,base_sku.ilike.%${t}%,brand.ilike.%${t}%`)
    .limit(15);
  const ids = (productos ?? []).map((p) => p.id);

  // 2) sus presentaciones, más las que matchean por nombre/SKU propio
  const filtros = [`name.ilike.%${t}%`, `sku.ilike.%${t}%`];
  if (ids.length) filtros.push(`product_id.in.(${ids.join(",")})`);
  const { data } = await supabase
    .from("product_variants")
    .select(
      "id, name, sku, cost, product:products!inner(name, is_deleted), variant_prices(price, price_tier_id)",
    )
    .eq("catalog_id", catalogo.id)
    .eq("is_deleted", false)
    .eq("product.is_deleted", false)
    .or(filtros.join(","))
    .order("name")
    .limit(20);
  const filas = data ?? [];

  const verCosto = esAdminCatalogo(catalogo) || catalogo.permisos.includes("costos");
  return filas.map((v) => ({
    variantId: v.id,
    producto: v.product.name,
    presentacion: v.name,
    sku: v.sku,
    precioGeneral:
      v.variant_prices.find((p) => p.price_tier_id === tierId)?.price ?? null,
    costo: verCosto && v.cost != null ? Number(v.cost) : null,
  }));
}

export async function guardarPrecioEspecial(
  slug: string,
  customerId: string,
  input: PrecioEspecialInput,
): Promise<ResultadoAccion> {
  const catalogo = await exigirPermiso(slug, "precios_especiales");
  const parsed = precioEspecialSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("customer_prices").upsert(
    {
      catalog_id: catalogo.id,
      customer_id: customerId,
      variant_id: d.variantId,
      price: d.price,
      reason: d.reason,
      ends_on: d.endsOn,
      created_by: user!.id,
      updated_by: user!.id,
    },
    { onConflict: "customer_id,variant_id" },
  );
  if (error) {
    return {
      ok: false,
      message: /debajo del costo/i.test(error.message)
        ? "Ese precio queda por debajo del costo: solo un administrador lo puede dar."
        : error.message,
    };
  }
  revalidatePath(`/panel/${slug}/clientes/${customerId}`);
  return { ok: true, message: "Precio especial guardado" };
}

export async function eliminarPrecioEspecial(
  slug: string,
  customerId: string,
  id: string,
): Promise<ResultadoAccion> {
  const catalogo = await exigirPermiso(slug, "precios_especiales");
  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_prices")
    .delete()
    .eq("id", id)
    .eq("customer_id", customerId)
    .eq("catalog_id", catalogo.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/panel/${slug}/clientes/${customerId}`);
  return { ok: true, message: "Precio especial quitado: vuelve al precio general" };
}
