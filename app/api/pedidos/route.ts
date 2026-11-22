import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashClave } from "@/lib/canales";

/**
 * Alta de pedidos desde canales externos (tiendas online, bot de WhatsApp).
 *
 * Auth: `Authorization: Bearer <clave del canal>` (se crea en Ventas →
 * Canales; se guarda solo el hash). Pensado para llamarse server-to-server:
 * no expone CORS, así que un navegador no puede usarlo.
 *
 * El pedido entra como "nuevo" al precio general: la base ignora cualquier
 * precio que venga y no toca stock ni cuenta corriente hasta que alguien del
 * panel lo confirma (ver crear_pedido_externo en la migración de ventas).
 */

const MAX_BYTES = 100_000;

const payloadSchema = z.object({
  referencia: z.string().trim().min(1).max(100).optional(),
  cliente: z.object({
    nombre: z.string().trim().min(1, "cliente.nombre es obligatorio").max(200),
    telefono: z.string().trim().max(50).optional(),
    email: z.string().trim().max(200).optional(),
    direccion: z.string().trim().max(300).optional(),
  }),
  notas: z.string().trim().max(1000).optional(),
  items: z
    .array(
      z.object({
        sku: z.string().trim().min(1).max(100),
        cantidad: z.number().positive().max(100000),
      }),
    )
    .min(1, "items no puede estar vacío")
    .max(200),
});

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const clave = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!clave.startsWith("ped_") || clave.length > 200) {
    return NextResponse.json({ error: "Clave de canal inválida" }, { status: 401 });
  }

  const texto = await req.text();
  if (texto.length > MAX_BYTES) {
    return NextResponse.json({ error: "Pedido demasiado grande" }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(texto);
  } catch {
    return NextResponse.json({ error: "Body inválido (se espera JSON)" }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Datos inválidos",
        detalle: parsed.error.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message })),
      },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: key } = await supabase
    .from("channel_keys")
    .select("id")
    .eq("key_hash", hashClave(clave))
    .eq("is_active", true)
    .maybeSingle();
  if (!key) {
    return NextResponse.json({ error: "Clave de canal inválida" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("crear_pedido_externo", {
    p_key_id: key.id,
    p_payload: parsed.data,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const r = data as { duplicado?: boolean };
  return NextResponse.json(data, { status: r?.duplicado ? 200 : 201 });
}
