"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirEdicion, exigirAdmin, type ResultadoAccion } from "@/lib/guards";
import { customerSchema, type CustomerInput } from "@/lib/validation/customer";
import { movimientoSchema, type MovimientoInput } from "@/lib/validation/ledger";

function rev(slug: string, id?: string) {
  revalidatePath(`/panel/${slug}/clientes`);
  if (id) revalidatePath(`/panel/${slug}/clientes/${id}`);
}

const dupMsg =
  "Ya existe un cliente activo con ese tipo y número de documento.";

export async function crearCliente(
  slug: string,
  input: CustomerInput,
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("customers")
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
        ? dupMsg
        : error?.message ?? "No se pudo crear el cliente",
    };
  }
  rev(slug);
  return { ok: true, message: "Cliente creado", data: { id: data.id } };
}

export async function actualizarCliente(
  slug: string,
  id: string,
  input: CustomerInput,
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("customers")
    .update({ ...parsed.data, updated_by: user!.id })
    .eq("id", id)
    .eq("catalog_id", catalogo.id);

  if (error) {
    return {
      ok: false,
      message: /duplicate|unique/i.test(error.message) ? dupMsg : error.message,
    };
  }
  rev(slug, id);
  return { ok: true, message: "Cliente actualizado", data: { id } };
}

export async function eliminarCliente(
  slug: string,
  id: string,
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("customers")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user!.id,
    })
    .eq("id", id)
    .eq("catalog_id", catalogo.id);
  if (error) return { ok: false, message: error.message };
  rev(slug, id);
  return { ok: true, message: "Cliente eliminado" };
}

export async function restaurarCliente(
  slug: string,
  id: string,
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ is_deleted: false, deleted_at: null, deleted_by: null })
    .eq("id", id)
    .eq("catalog_id", catalogo.id);
  if (error) return { ok: false, message: error.message };
  rev(slug, id);
  return { ok: true, message: "Cliente restaurado" };
}

// ------------------------------------------------------------
// Cuenta corriente
// ------------------------------------------------------------
export async function agregarMovimiento(
  slug: string,
  customerId: string,
  input: MovimientoInput,
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  const parsed = movimientoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("customer_transactions").insert({
    catalog_id: catalogo.id,
    customer_id: customerId,
    kind: parsed.data.kind,
    amount: parsed.data.amount,
    due_date: parsed.data.due_date,
    note: parsed.data.note,
    created_by: user!.id,
    updated_by: user!.id,
  });
  if (error) return { ok: false, message: error.message };
  rev(slug, customerId);
  return { ok: true, message: "Movimiento registrado" };
}

export async function eliminarMovimiento(
  slug: string,
  customerId: string,
  movimientoId: string,
): Promise<ResultadoAccion> {
  await exigirAdmin(slug);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("customer_transactions")
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: user!.id })
    .eq("id", movimientoId)
    .eq("customer_id", customerId);
  if (error) return { ok: false, message: error.message };
  rev(slug, customerId);
  return { ok: true, message: "Movimiento eliminado" };
}
