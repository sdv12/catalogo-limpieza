"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  exigirEdicion,
  exigirAdmin,
  type ResultadoAccion,
} from "@/lib/guards";
import { sanitizarBusqueda } from "@/lib/format";
import { supplierSchema, type SupplierInput } from "@/lib/validation/supplier";

function rev(slug: string, id?: string) {
  revalidatePath(`/panel/${slug}/proveedores`);
  revalidatePath(`/panel/${slug}/productos`);
  if (id) revalidatePath(`/panel/${slug}/proveedores/${id}`);
}

export async function crearProveedor(
  slug: string,
  input: SupplierInput,
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      ...parsed.data,
      catalog_id: catalogo.id,
      created_by: user!.id,
      updated_by: user!.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: /duplicate|unique/i.test(error?.message ?? "")
        ? "Ya existe un proveedor con ese documento."
        : error?.message ?? "No se pudo crear el proveedor",
    };
  }
  rev(slug);
  return { ok: true, message: "Proveedor creado", data: { id: data.id } };
}

export async function actualizarProveedor(
  slug: string,
  id: string,
  input: SupplierInput,
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("suppliers")
    .update({ ...parsed.data, updated_by: user!.id })
    .eq("id", id)
    .eq("catalog_id", catalogo.id);

  if (error) return { ok: false, message: error.message };
  rev(slug, id);
  return { ok: true, message: "Proveedor actualizado", data: { id } };
}

export async function eliminarProveedor(
  slug: string,
  id: string,
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("suppliers")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user!.id,
    })
    .eq("id", id)
    .eq("catalog_id", catalogo.id);
  if (error) return { ok: false, message: error.message };
  rev(slug, id);
  return { ok: true, message: "Proveedor eliminado" };
}

export async function restaurarProveedor(
  slug: string,
  id: string,
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ is_deleted: false, deleted_at: null, deleted_by: null })
    .eq("id", id)
    .eq("catalog_id", catalogo.id);
  if (error) return { ok: false, message: error.message };
  rev(slug, id);
  return { ok: true, message: "Proveedor restaurado" };
}

// ------------------------------------------------------------
// Relación producto ↔ proveedor
// ------------------------------------------------------------
export async function vincularProveedor(
  slug: string,
  productId: string,
  input: {
    supplierId: string;
    supplierSku?: string | null;
    cost?: number | null;
    leadTimeDays?: number | null;
    isPrimary?: boolean;
    notes?: string | null;
  },
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  const supabase = await createClient();

  if (input.isPrimary) {
    await supabase
      .from("product_suppliers")
      .update({ is_primary: false })
      .eq("product_id", productId);
  }

  const { error } = await supabase.from("product_suppliers").upsert({
    product_id: productId,
    supplier_id: input.supplierId,
    catalog_id: catalogo.id,
    supplier_sku: input.supplierSku || null,
    cost: input.cost ?? null,
    lead_time_days: input.leadTimeDays ?? null,
    is_primary: input.isPrimary ?? false,
    notes: input.notes || null,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/panel/${slug}/productos/${productId}`);
  return { ok: true, message: "Proveedor vinculado" };
}

export async function desvincularProveedor(
  slug: string,
  productId: string,
  supplierId: string,
): Promise<ResultadoAccion> {
  await exigirEdicion(slug);
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_suppliers")
    .delete()
    .eq("product_id", productId)
    .eq("supplier_id", supplierId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/panel/${slug}/productos/${productId}`);
  return { ok: true, message: "Proveedor desvinculado" };
}

// ------------------------------------------------------------
// Coordinación proveedor ↔ productos
// ------------------------------------------------------------

/** Busca productos del catálogo que todavía NO están vinculados al proveedor. */
export async function buscarProductosProveedor(
  slug: string,
  supplierId: string,
  q: string,
): Promise<{ id: string; name: string; brand: string | null; base_sku: string | null }[]> {
  const catalogo = await exigirEdicion(slug);
  const t = sanitizarBusqueda(q);
  if (t.length < 2) return [];
  const supabase = await createClient();

  const [{ data: prods }, { data: vinculados }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, brand, base_sku")
      .eq("catalog_id", catalogo.id)
      .eq("is_deleted", false)
      .or(`name.ilike.%${t}%,base_sku.ilike.%${t}%,brand.ilike.%${t}%`)
      .order("name")
      .limit(30),
    supabase
      .from("product_suppliers")
      .select("product_id")
      .eq("supplier_id", supplierId),
  ]);

  const ya = new Set((vinculados ?? []).map((v) => v.product_id));
  return (prods ?? []).filter((p) => !ya.has(p.id)).slice(0, 12);
}

export async function agregarProductosAProveedor(
  slug: string,
  supplierId: string,
  productIds: string[],
  setPrimary: boolean,
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  if (productIds.length === 0)
    return { ok: false, message: "Elegí al menos un producto." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vincular_productos_proveedor", {
    p_catalog_id: catalogo.id,
    p_supplier_id: supplierId,
    p_product_ids: productIds,
    p_set_primary: setPrimary,
  });
  if (error) return { ok: false, message: error.message };
  rev(slug, supplierId);
  return {
    ok: true,
    message: `${data ?? 0} ${data === 1 ? "producto vinculado" : "productos vinculados"}`,
  };
}

type CostoInput = {
  mode: "percent" | "set";
  value: number;
  round: boolean;
};

export async function ajustarCostosProveedor(
  slug: string,
  supplierId: string,
  input: CostoInput,
  dryRun: boolean,
): Promise<ResultadoAccion & { data?: { productos: number; con_costo: number } }> {
  const catalogo = await exigirAdmin(slug);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ajustar_costo_proveedor", {
    p_catalog_id: catalogo.id,
    p_supplier_id: supplierId,
    p_mode: input.mode,
    p_value: input.value,
    p_round: input.round,
    p_dry_run: dryRun,
  });
  if (error) return { ok: false, message: error.message };
  if (!dryRun) {
    rev(slug, supplierId);
    revalidatePath(`/panel/${slug}/actividad`);
  }
  const r = data as unknown as { productos: number; con_costo: number };
  return {
    ok: true,
    message: dryRun ? "" : `Costos actualizados (${r.con_costo})`,
    data: r,
  };
}

export async function propagarCostosProveedor(
  slug: string,
  supplierId: string,
  soloSinCosto: boolean,
  dryRun: boolean,
): Promise<ResultadoAccion & { data?: { presentaciones: number; productos: number } }> {
  const catalogo = await exigirAdmin(slug);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("propagar_costo_proveedor", {
    p_catalog_id: catalogo.id,
    p_supplier_id: supplierId,
    p_solo_sin_costo: soloSinCosto,
    p_dry_run: dryRun,
  });
  if (error) return { ok: false, message: error.message };
  if (!dryRun) {
    rev(slug, supplierId);
    revalidatePath(`/panel/${slug}/actividad`);
  }
  const r = data as unknown as { presentaciones: number; productos: number };
  return {
    ok: true,
    message: dryRun
      ? ""
      : `${r.presentaciones} ${r.presentaciones === 1 ? "presentación actualizada" : "presentaciones actualizadas"}`,
    data: r,
  };
}
