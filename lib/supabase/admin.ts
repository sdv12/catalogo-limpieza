import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { DEMO_LOCAL } from "@/lib/demo/activo";
import { crearClienteDemo } from "@/lib/demo/cliente";

/**
 * Cliente con service_role. Salta RLS y NO registra auth.uid() en la
 * auditoría. Usos permitidos: crear usuarios de Auth (alta de usuarios) y
 * /api/pedidos (validar la clave del canal y llamar a crear_pedido_externo).
 * Nunca para escribir el catálogo directo.
 */
export function createAdminClient() {
  if (DEMO_LOCAL) {
    return crearClienteDemo(null) as unknown as ReturnType<typeof createClient<Database>>;
  }
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
