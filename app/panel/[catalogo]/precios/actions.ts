"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin, type ResultadoAccion } from "@/lib/guards";
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
  const catalogo = await exigirAdmin(slug);
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
  await exigirAdmin(slug);
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
  await exigirAdmin(slug);
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
  const catalogo = await exigirAdmin(slug);
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
  await exigirAdmin(slug);
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
// Actualización de precios en lote
// ------------------------------------------------------------
const loteSchema = z.object({
  categoryId: z.string().uuid().nullable(),
  tierIds: z.array(z.string().uuid()),
  mode: z.enum(["percent", "amount", "set"]),
  value: z.number(),
  round: z.boolean(),
});

type LoteInput = z.infer<typeof loteSchema>;

export async function previsualizarPrecios(
  slug: string,
  input: LoteInput,
): Promise<ResultadoAccion & { data?: { count: number } }> {
  const catalogo = await exigirAdmin(slug);
  const parsed = loteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_bulk_price_update", {
    p_catalog_id: catalogo.id,
    p_category_id: parsed.data.categoryId ?? undefined,
    p_tier_ids: parsed.data.tierIds.length ? parsed.data.tierIds : undefined,
    p_mode: parsed.data.mode,
    p_value: parsed.data.value,
    p_round: parsed.data.round,
    p_dry_run: true,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "", data: { count: data ?? 0 } };
}

export async function aplicarPrecios(
  slug: string,
  input: LoteInput,
): Promise<ResultadoAccion & { data?: { count: number } }> {
  const catalogo = await exigirAdmin(slug);
  const parsed = loteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (parsed.data.mode !== "set" && parsed.data.value === 0)
    return { ok: false, message: "El valor no puede ser cero." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_bulk_price_update", {
    p_catalog_id: catalogo.id,
    p_category_id: parsed.data.categoryId ?? undefined,
    p_tier_ids: parsed.data.tierIds.length ? parsed.data.tierIds : undefined,
    p_mode: parsed.data.mode,
    p_value: parsed.data.value,
    p_round: parsed.data.round,
    p_dry_run: false,
  });
  if (error) return { ok: false, message: error.message };
  rev(slug);
  revalidatePath(`/panel/${slug}/actividad`);
  return {
    ok: true,
    message: `${data ?? 0} precios actualizados`,
    data: { count: data ?? 0 },
  };
}
