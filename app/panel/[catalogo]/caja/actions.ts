"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirEdicion, type ResultadoAccion } from "@/lib/guards";
import { lineasPagoSchema } from "@/lib/validation/cobro";
import { enviarReciboPorMail } from "@/lib/recibos";
import type { LineaPago } from "@/lib/ventas";

function rev(slug: string) {
  revalidatePath(`/panel/${slug}/caja`, "layout");
}

const msg = (e: { message: string } | null, d: string) => e?.message?.trim() || d;

export async function abrirCaja(slug: string, inicial: number): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  if (!Number.isFinite(inicial) || inicial < 0) {
    return { ok: false, message: "Indicá el efectivo con el que arrancás (puede ser 0)" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("abrir_caja", { p_catalog: catalogo.id, p_opening: inicial });
  rev(slug);
  if (error) return { ok: false, message: msg(error, "No se pudo abrir la caja") };
  return { ok: true, message: "Caja abierta" };
}

export async function registrarCobro(
  slug: string,
  destino: { customerId: string | null; orderId: string | null },
  lineas: LineaPago[],
  nota: string | null,
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  const parsed = lineasPagoSchema.safeParse(lineas);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("registrar_cobro", {
    p_catalog: catalogo.id,
    p_customer: destino.customerId,
    p_order: destino.orderId,
    p_lines: parsed.data,
    p_note: nota?.trim() || null,
  });
  rev(slug);
  if (destino.customerId) revalidatePath(`/panel/${slug}/clientes/${destino.customerId}`);
  if (destino.orderId) revalidatePath(`/panel/${slug}/ventas/${destino.orderId}`);
  if (error || !id) return { ok: false, message: msg(error, "No se pudo registrar el cobro") };

  const enviado = await enviarReciboPorMail(catalogo, id);
  return {
    ok: true,
    message: enviado ? "Cobro registrado. Recibo enviado por mail." : "Cobro registrado",
    data: { id },
  };
}

export async function registrarMovimientoCaja(
  slug: string,
  tipo: "ingreso" | "egreso",
  importe: number,
  motivo: string,
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_movimiento_caja", {
    p_catalog: catalogo.id,
    p_kind: tipo,
    p_amount: importe,
    p_reason: motivo,
  });
  rev(slug);
  if (error) return { ok: false, message: msg(error, "No se pudo registrar") };
  return { ok: true, message: tipo === "ingreso" ? "Ingreso registrado" : "Egreso registrado" };
}

export async function cerrarCaja(
  slug: string,
  sessionId: string,
  contado: number,
  nota: string | null,
): Promise<ResultadoAccion> {
  await exigirEdicion(slug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("cerrar_caja", {
    p_session: sessionId,
    p_counted: contado,
    p_note: nota?.trim() || null,
  });
  rev(slug);
  if (error) return { ok: false, message: msg(error, "No se pudo cerrar la caja") };
  return { ok: true, message: "Caja cerrada" };
}

export async function anularRecibo(
  slug: string,
  reciboId: string,
  motivo: string,
): Promise<ResultadoAccion> {
  await exigirEdicion(slug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_recibo", { p_receipt: reciboId, p_reason: motivo });
  rev(slug);
  revalidatePath(`/panel/${slug}/clientes`, "layout");
  revalidatePath(`/panel/${slug}/ventas`, "layout");
  if (error) return { ok: false, message: msg(error, "No se pudo anular") };
  return { ok: true, message: "Recibo anulado" };
}

export async function reenviarRecibo(slug: string, reciboId: string): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  const ok = await enviarReciboPorMail(catalogo, reciboId);
  rev(slug);
  return ok
    ? { ok: true, message: "Recibo enviado por mail" }
    : {
        ok: false,
        message:
          "No se pudo mandar: el cliente no tiene email cargado o el envío de mails todavía no está configurado.",
      };
}
