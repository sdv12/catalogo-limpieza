"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { exigirPermiso, type ResultadoAccion } from "@/lib/guards";
import { generarSlug } from "@/lib/format";

const rev = (slug: string) => {
  revalidatePath(`/panel/${slug}/precios`);
  revalidatePath(`/panel/${slug}/productos`);
};

const tierSchema = z.object({
  name: z.string().trim().min(2, "Nombre muy corto"),
});

export async function crearTier(
  slug: string,
  name: string,
): Promise<ResultadoAccion> {
  const catalogo = await exigirPermiso(slug, "precios_lote");
  const parsed = tierSchema.safeParse({ name });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await createClient();
  const code = generarSlug(parsed.data.name).replace(/-/g, "_") || "nivel";
  const { data: existentes } = await supabase
    .from("price_tiers")
    .select("sort_order")
    .eq("catalog_id", catalogo.id);
  const orden =
    Math.max(0, ...((existentes ?? []).map((t) => t.sort_order) as number[])) + 1;

  const { error } = await supabase.from("price_tiers").insert({
    catalog_id: catalogo.id,
    name: parsed.data.name,
    code,
    sort_order: orden,
    is_default: (existentes ?? []).length === 0,
  });
  if (error)
    return {
      ok: false,
      message: /duplicate|unique/i.test(error.message)
        ? "Ya existe un nivel con ese nombre"
        : error.message,
    };
  rev(slug);
  return { ok: true, message: "Nivel creado" };
}

export async function renombrarTier(
  slug: string,
  id: string,
  name: string,
): Promise<ResultadoAccion> {
  await exigirPermiso(slug, "precios_lote");
  const parsed = tierSchema.safeParse({ name });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("price_tiers")
    .update({ name: parsed.data.name })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  rev(slug);
  return { ok: true, message: "Nivel renombrado" };
}

export async function toggleTier(
  slug: string,
  id: string,
  isActive: boolean,
): Promise<ResultadoAccion> {
  await exigirPermiso(slug, "precios_lote");
  const supabase = await createClient();
  const { error } = await supabase
    .from("price_tiers")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  rev(slug);
  return { ok: true, message: isActive ? "Nivel activado" : "Nivel desactivado" };
}

export async function fijarTierDefault(
  slug: string,
  id: string,
): Promise<ResultadoAccion> {
  const catalogo = await exigirPermiso(slug, "precios_lote");
  const supabase = await createClient();
  await supabase
    .from("price_tiers")
    .update({ is_default: false })
    .eq("catalog_id", catalogo.id)
    .neq("id", id);
  const { error } = await supabase
    .from("price_tiers")
    .update({ is_default: true })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  rev(slug);
  return { ok: true, message: "Nivel por defecto actualizado" };
}

export async function eliminarTier(
  slug: string,
  id: string,
): Promise<ResultadoAccion> {
  await exigirPermiso(slug, "precios_lote");
  const supabase = await createClient();
  const { error } = await supabase.from("price_tiers").delete().eq("id", id);
  if (error)
    return {
      ok: false,
      message: /foreign key|violates/i.test(error.message)
        ? "No se puede eliminar: hay productos con precios en este nivel."
        : error.message,
    };
  rev(slug);
  return { ok: true, message: "Nivel eliminado" };
}

// ------------------------------------------------------------
// Reprecio en lote sobre el conjunto filtrado del listado de productos
// ------------------------------------------------------------
const filtroSchema = z.object({
  q: z.string().trim().max(120).optional(),
  categoria: z.string().uuid().optional(),
  marca: z.string().trim().max(120).optional(),
  proveedor: z.string().uuid().optional(),
  estado: z.enum(["active", "inactive"]).optional(),
  stock: z.enum(["low", "ok"]).optional(),
});

const reprecioSchema = z.object({
  filtro: filtroSchema,
  tierIds: z.array(z.string().uuid()),
  mode: z.enum(["percent", "amount", "set", "margin"]),
  value: z.number(),
  round: z.boolean(),
});

export type FiltroProductos = z.infer<typeof filtroSchema>;
export type ReprecioInput = z.infer<typeof reprecioSchema>;
export type ReprecioResultado = { productos: number; precios: number; sin_costo: number };

function argsRpc(catalogId: string, input: ReprecioInput, dryRun: boolean) {
  const f = input.filtro;
  return {
    p_catalog_id: catalogId,
    p_q: f.q || undefined,
    p_category_id: f.categoria || undefined,
    p_brand: f.marca || undefined,
    p_supplier_id: f.proveedor || undefined,
    p_status: f.estado || undefined,
    p_stock: f.stock || undefined,
    p_tier_ids: input.tierIds.length ? input.tierIds : undefined,
    p_mode: input.mode,
    p_value: input.value,
    p_round: input.round,
    p_dry_run: dryRun,
  };
}

export async function previsualizarReprecio(
  slug: string,
  input: ReprecioInput,
): Promise<ResultadoAccion & { data?: ReprecioResultado }> {
  const catalogo = await exigirPermiso(slug, "precios_lote");
  const parsed = reprecioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "reprecio_por_filtro",
    argsRpc(catalogo.id, parsed.data, true),
  );
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "", data: data as unknown as ReprecioResultado };
}

export async function aplicarReprecio(
  slug: string,
  input: ReprecioInput,
): Promise<ResultadoAccion & { data?: ReprecioResultado }> {
  const catalogo = await exigirPermiso(slug, "precios_lote");
  const parsed = reprecioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (parsed.data.mode !== "set" && parsed.data.value === 0)
    return { ok: false, message: "El valor no puede ser cero." };
  if (parsed.data.mode === "margin" && parsed.data.value < 0)
    return { ok: false, message: "El margen no puede ser negativo." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "reprecio_por_filtro",
    argsRpc(catalogo.id, parsed.data, false),
  );
  if (error) return { ok: false, message: error.message };
  rev(slug);
  revalidatePath(`/panel/${slug}/actividad`);
  const r = data as unknown as ReprecioResultado;
  return {
    ok: true,
    message: `${r.precios} ${r.precios === 1 ? "precio actualizado" : "precios actualizados"}`,
    data: r,
  };
}
