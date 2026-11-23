import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CatalogoAccesible } from "@/lib/roles";
import { METODOS_PAGO, type MetodoPago } from "@/lib/ventas";

export type SesionCaja = {
  id: string;
  userId: string;
  usuario: string;
  status: "abierta" | "cerrada";
  openedAt: string;
  closedAt: string | null;
  inicial: number;
  esperado: number;
  contado: number | null;
  diferencia: number | null;
  nota: string | null;
  porMetodo: Record<MetodoPago, number>;
  ingresos: number;
  egresos: number;
  recibos: {
    id: string;
    number: number;
    total: number;
    status: "valido" | "anulado";
    createdAt: string;
    cliente: string | null;
    pedido: { id: string; number: number } | null;
    metodos: string;
    voidReason: string | null;
  }[];
  movimientos: { id: string; kind: "ingreso" | "egreso"; amount: number; reason: string; createdAt: string }[];
};

async function nombres(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, p.full_name || p.email || "Usuario"]));
}

export async function cargarSesion(
  catalogo: CatalogoAccesible,
  id: string,
): Promise<SesionCaja | null> {
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("cash_sessions")
    .select("*")
    .eq("id", id)
    .eq("catalog_id", catalogo.id)
    .maybeSingle();
  if (!s) return null;

  const [{ data: recibos }, { data: movs }, { data: esperado }, usuarios] = await Promise.all([
    supabase
      .from("receipts")
      .select(
        "id, number, total, status, created_at, void_reason, customer:customers(name), order:orders(id, number, contact_name), receipt_lines(method, amount)",
      )
      .eq("session_id", id)
      .order("number", { ascending: false }),
    supabase
      .from("cash_movements")
      .select("id, kind, amount, reason, created_at")
      .eq("session_id", id)
      .order("created_at", { ascending: false }),
    supabase.rpc("efectivo_esperado", { p_session: id }),
    nombres([s.user_id]),
  ]);

  const porMetodo = Object.fromEntries(METODOS_PAGO.map((m) => [m, 0])) as Record<MetodoPago, number>;
  for (const r of recibos ?? []) {
    if (r.status !== "valido") continue;
    for (const l of r.receipt_lines) porMetodo[l.method as MetodoPago] += Number(l.amount);
  }
  const ingresos = (movs ?? []).filter((m) => m.kind === "ingreso").reduce((a, m) => a + Number(m.amount), 0);
  const egresos = (movs ?? []).filter((m) => m.kind === "egreso").reduce((a, m) => a + Number(m.amount), 0);

  return {
    id: s.id,
    userId: s.user_id,
    usuario: usuarios.get(s.user_id) ?? "Usuario",
    status: s.status as "abierta" | "cerrada",
    openedAt: s.opened_at,
    closedAt: s.closed_at,
    inicial: Number(s.opening_amount),
    esperado: s.status === "cerrada" ? Number(s.expected_cash) : Number(esperado ?? 0),
    contado: s.counted_cash != null ? Number(s.counted_cash) : null,
    diferencia: s.difference != null ? Number(s.difference) : null,
    nota: s.closing_note,
    porMetodo,
    ingresos,
    egresos,
    recibos: (recibos ?? []).map((r) => ({
      id: r.id,
      number: r.number,
      total: Number(r.total),
      status: r.status as "valido" | "anulado",
      createdAt: r.created_at,
      cliente: r.customer?.name ?? r.order?.contact_name ?? null,
      pedido: r.order ? { id: r.order.id, number: r.order.number } : null,
      metodos: [...new Set(r.receipt_lines.map((l) => l.method))].join(","),
      voidReason: r.void_reason,
    })),
    movimientos: (movs ?? []).map((m) => ({
      id: m.id,
      kind: m.kind as "ingreso" | "egreso",
      amount: Number(m.amount),
      reason: m.reason,
      createdAt: m.created_at,
    })),
  };
}

/** Cajas para el listado (las propias, o todas con caja_admin: lo filtra RLS). */
export async function listarSesiones(catalogo: CatalogoAccesible, soloUsuario?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("cash_sessions")
    .select("id, user_id, status, opened_at, closed_at, opening_amount, expected_cash, counted_cash, difference")
    .eq("catalog_id", catalogo.id)
    .order("opened_at", { ascending: false })
    .limit(40);
  if (soloUsuario) q = q.eq("user_id", soloUsuario);
  const { data } = await q;
  const usuarios = await nombres([...new Set((data ?? []).map((s) => s.user_id))]);
  return (data ?? []).map((s) => ({
    id: s.id,
    usuario: usuarios.get(s.user_id) ?? "Usuario",
    userId: s.user_id,
    status: s.status as "abierta" | "cerrada",
    openedAt: s.opened_at,
    closedAt: s.closed_at,
    diferencia: s.difference != null ? Number(s.difference) : null,
  }));
}
