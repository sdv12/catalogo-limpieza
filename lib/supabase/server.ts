import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { DEMO_LOCAL, COOKIE_USUARIO_DEMO } from "@/lib/demo/activo";
import { crearClienteDemo, ID_USUARIO_DEMO_POR_DEFECTO } from "@/lib/demo/cliente";

/**
 * Cliente Supabase para Server Components, Server Actions y Route Handlers.
 * Usa la sesión del usuario (cookies) — nunca el service_role — para que la
 * auditoría en la base registre `auth.uid()` en cada cambio.
 */
export async function createClient() {
  const cookieStore = await cookies();

  if (DEMO_LOCAL) {
    const usuario = cookieStore.get(COOKIE_USUARIO_DEMO)?.value || ID_USUARIO_DEMO_POR_DEFECTO;
    return crearClienteDemo(usuario) as unknown as ReturnType<typeof createServerClient<Database>>;
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: el refresco de sesión lo
            // escribe el proxy (proxy.ts).
          }
        },
      },
    },
  );
}
