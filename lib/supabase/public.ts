import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { DEMO_LOCAL } from "@/lib/demo/activo";
import { crearClienteDemo } from "@/lib/demo/cliente";

/**
 * Cliente Supabase sin sesión, para los endpoints públicos (/api/publico/*).
 * Solo puede ejecutar las funciones storefront_* (SECURITY DEFINER, solo lectura).
 */
export function createPublicClient() {
  if (DEMO_LOCAL) {
    return crearClienteDemo(null) as unknown as ReturnType<typeof createClient<Database>>;
  }
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Base pública del bucket de imágenes. */
export const IMAGENES_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/product-images/`;
