"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirEdicion, type ResultadoAccion } from "@/lib/guards";
import { supplierSchema, type SupplierInput } from "@/lib/validation/supplier";

function rev(slug: string, id?: string) {
  revalidatePath(`/panel/${slug}/proveedores`);
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
