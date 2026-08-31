"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { exigirEdicion, type ResultadoAccion } from "@/lib/guards";
import { generarSlug } from "@/lib/format";

const RAIZ = "00000000-0000-0000-0000-000000000000";

const nombreSchema = z.string().trim().min(2, "El nombre es muy corto");

export async function crearCategoria(
  slug: string,
  data: { name: string; parentId?: string | null },
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  const parsed = nombreSchema.safeParse(data.name);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await createClient();
  const parent_id = data.parentId && data.parentId !== RAIZ ? data.parentId : null;

  const hermanasQ = supabase
    .from("categories")
    .select("sort_order")
    .eq("catalog_id", catalogo.id);
  const { data: hermanas } = await (parent_id
    ? hermanasQ.eq("parent_id", parent_id)
    : hermanasQ.is("parent_id", null));

  const orden =
    Math.max(0, ...((hermanas ?? []).map((h) => h.sort_order) as number[])) + 1;

  const { error } = await supabase.from("categories").insert({
    catalog_id: catalogo.id,
    parent_id,
    name: parsed.data,
    slug: generarSlug(parsed.data),
    sort_order: orden,
  });

  if (error) {
    return {
      ok: false,
      message: /duplicate|unique/i.test(error.message)
        ? "Ya existe una categoría con ese nombre en el mismo nivel"
        : error.message,
    };
  }
  revalidatePath(`/panel/${slug}/categorias`);
  return { ok: true, message: "Categoría creada" };
}

export async function renombrarCategoria(
  slug: string,
  id: string,
  name: string,
): Promise<ResultadoAccion> {
  await exigirEdicion(slug);
  const parsed = nombreSchema.safeParse(name);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ name: parsed.data, slug: generarSlug(parsed.data) })
    .eq("id", id);
  if (error) {
    return {
      ok: false,
      message: /duplicate|unique/i.test(error.message)
        ? "Ya existe una categoría con ese nombre en el mismo nivel"
        : error.message,
    };
  }
  revalidatePath(`/panel/${slug}/categorias`);
  return { ok: true, message: "Categoría renombrada" };
}

export async function toggleCategoria(
  slug: string,
  id: string,
  isActive: boolean,
): Promise<ResultadoAccion> {
  await exigirEdicion(slug);
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/panel/${slug}/categorias`);
  return { ok: true, message: isActive ? "Categoría activada" : "Categoría desactivada" };
}

export async function moverCategoria(
  slug: string,
  id: string,
  direccion: "arriba" | "abajo",
): Promise<ResultadoAccion> {
  await exigirEdicion(slug);
  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("categories")
    .select("id, sort_order, parent_id, catalog_id")
    .eq("id", id)
    .single();
  if (!actual) return { ok: false, message: "Categoría no encontrada" };

  let q = supabase
    .from("categories")
    .select("id, sort_order")
    .eq("catalog_id", actual.catalog_id);
  q = actual.parent_id
    ? q.eq("parent_id", actual.parent_id)
    : q.is("parent_id", null);
  q =
    direccion === "arriba"
      ? q.lt("sort_order", actual.sort_order).order("sort_order", { ascending: false })
      : q.gt("sort_order", actual.sort_order).order("sort_order", { ascending: true });

  const { data: vecino } = await q.limit(1).maybeSingle();
  if (!vecino) return { ok: true, message: "" };

  await supabase
    .from("categories")
    .update({ sort_order: vecino.sort_order })
    .eq("id", actual.id);
  await supabase
    .from("categories")
    .update({ sort_order: actual.sort_order })
    .eq("id", vecino.id);

  revalidatePath(`/panel/${slug}/categorias`);
  return { ok: true, message: "Orden actualizado" };
}

export async function eliminarCategoria(
  slug: string,
  id: string,
): Promise<ResultadoAccion> {
  await exigirEdicion(slug);
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    return {
      ok: false,
      message: /foreign key|violates/i.test(error.message)
        ? "No se puede eliminar: tiene productos o subcategorías asociadas."
        : error.message,
    };
  }
  revalidatePath(`/panel/${slug}/categorias`);
  return { ok: true, message: "Categoría eliminada" };
}
