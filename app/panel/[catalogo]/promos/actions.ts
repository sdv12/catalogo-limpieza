"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirPermiso, type ResultadoAccion } from "@/lib/guards";
import { sanitizarBusqueda } from "@/lib/format";
import { promoSchema, type PromoInput } from "@/lib/validation/promo";

function rev(slug: string) {
  revalidatePath(`/panel/${slug}/promos`);
  revalidatePath(`/panel/${slug}`);
}

function fila(catalogId: string, userId: string, d: PromoInput) {
  return {
    catalog_id: catalogId,
    kind: d.kind,
    product_id: d.productId,
    title: d.title,
    subtitle: d.subtitle,
    link: d.link,
    discount_type: d.kind === "oferta" ? d.discountType : null,
    discount_value: d.kind === "oferta" ? d.discountValue : null,
    starts_at: d.startsAt,
    ends_at: d.endsAt,
    is_active: d.isActive,
    updated_by: userId,
  };
}

export async function buscarProductosPromo(
  slug: string,
  q: string,
): Promise<{ id: string; name: string; brand: string | null }[]> {
  const catalogo = await exigirPermiso(slug, "promos");
  const t = sanitizarBusqueda(q);
  if (t.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, brand")
    .eq("catalog_id", catalogo.id)
    .eq("is_deleted", false)
    .eq("status", "active")
    .or(`name.ilike.%${t}%,base_sku.ilike.%${t}%,brand.ilike.%${t}%`)
    .order("name")
    .limit(10);
  return data ?? [];
}

export async function crearPromo(
  slug: string,
  input: PromoInput,
): Promise<ResultadoAccion> {
  const catalogo = await exigirPermiso(slug, "promos");
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ult } = await supabase
    .from("promotions")
    .select("position")
    .eq("catalog_id", catalogo.id)
    .eq("kind", parsed.data.kind)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("promotions").insert({
    ...fila(catalogo.id, user!.id, parsed.data),
    created_by: user!.id,
    position: (ult?.position ?? 0) + 1,
  });
  if (error) return { ok: false, message: error.message };
  rev(slug);
  return { ok: true, message: "Promo creada" };
}

export async function actualizarPromo(
  slug: string,
  id: string,
  input: PromoInput,
): Promise<ResultadoAccion> {
  const catalogo = await exigirPermiso(slug, "promos");
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("promotions")
    .update(fila(catalogo.id, user!.id, parsed.data))
    .eq("id", id)
    .eq("catalog_id", catalogo.id);
  if (error) return { ok: false, message: error.message };
  rev(slug);
  return { ok: true, message: "Promo actualizada" };
}

export async function eliminarPromo(
  slug: string,
  id: string,
): Promise<ResultadoAccion> {
  const catalogo = await exigirPermiso(slug, "promos");
  const supabase = await createClient();
  const { error } = await supabase
    .from("promotions")
    .delete()
    .eq("id", id)
    .eq("catalog_id", catalogo.id);
  if (error) return { ok: false, message: error.message };
  rev(slug);
  return { ok: true, message: "Promo eliminada" };
}

export async function togglePromo(
  slug: string,
  id: string,
  activar: boolean,
): Promise<ResultadoAccion> {
  const catalogo = await exigirPermiso(slug, "promos");
  const supabase = await createClient();

  const { data: promo } = await supabase
    .from("promotions")
    .select("kind")
    .eq("id", id)
    .eq("catalog_id", catalogo.id)
    .maybeSingle();
  if (!promo) return { ok: false, message: "No se encontró la promo" };

  if (activar) {
    // pasa a orden 1: el resto de su tipo baja un lugar
    const { data: otras } = await supabase
      .from("promotions")
      .select("id, position")
      .eq("catalog_id", catalogo.id)
      .eq("kind", promo.kind)
      .neq("id", id);
    for (const o of otras ?? []) {
      await supabase
        .from("promotions")
        .update({ position: o.position + 1 })
        .eq("id", o.id);
    }
  }

  const { error } = await supabase
    .from("promotions")
    .update({ is_active: activar, ...(activar ? { position: 1 } : {}) })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  rev(slug);
  return { ok: true, message: activar ? "Promo activada (orden 1)" : "Promo pausada" };
}

export async function moverPromo(
  slug: string,
  id: string,
  dir: "subir" | "bajar",
): Promise<ResultadoAccion> {
  const catalogo = await exigirPermiso(slug, "promos");
  const supabase = await createClient();

  const { data: promo } = await supabase
    .from("promotions")
    .select("id, kind, position")
    .eq("id", id)
    .eq("catalog_id", catalogo.id)
    .maybeSingle();
  if (!promo) return { ok: false, message: "No se encontró la promo" };

  const { data: hermanas } = await supabase
    .from("promotions")
    .select("id, position")
    .eq("catalog_id", catalogo.id)
    .eq("kind", promo.kind)
    .order("position");
  const lista = hermanas ?? [];
  const i = lista.findIndex((x) => x.id === id);
  const j = dir === "subir" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= lista.length)
    return { ok: true, message: "" };

  await supabase
    .from("promotions")
    .update({ position: lista[j].position })
    .eq("id", lista[i].id);
  await supabase
    .from("promotions")
    .update({ position: lista[i].position })
    .eq("id", lista[j].id);
  rev(slug);
  return { ok: true, message: "" };
}
