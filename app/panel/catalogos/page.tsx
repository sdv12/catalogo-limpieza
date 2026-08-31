import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { exigirSuperadmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { CatalogosAdmin } from "@/components/catalogs/CatalogosAdmin";

export const metadata = { title: "Catálogos y usuarios — Admin" };

export type MiembroVista = {
  user_id: string;
  role: "editor" | "viewer";
  email: string | null;
  full_name: string | null;
  is_superadmin: boolean;
};

export default async function AdminCatalogosPage() {
  await exigirSuperadmin();
  const supabase = await createClient();

  const [{ data: catalogos }, { data: miembros }, { data: perfiles }] =
    await Promise.all([
      supabase
        .from("catalogs")
        .select("id, slug, name, is_active, created_at")
        .order("name"),
      supabase
        .from("catalog_members")
        .select("catalog_id, user_id, role"),
      supabase
        .from("profiles")
        .select("id, email, full_name, is_superadmin, is_active")
        .order("email"),
    ]);

  const perfilPorId = new Map((perfiles ?? []).map((p) => [p.id, p]));
  const miembrosPorCatalogo: Record<string, MiembroVista[]> = {};
  for (const m of miembros ?? []) {
    const p = perfilPorId.get(m.user_id);
    (miembrosPorCatalogo[m.catalog_id] ??= []).push({
      user_id: m.user_id,
      role: m.role as "editor" | "viewer",
      email: p?.email ?? null,
      full_name: p?.full_name ?? null,
      is_superadmin: p?.is_superadmin ?? false,
    });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center gap-3 border-b border-linea bg-superficie px-4 sm:px-6">
        <Link
          href="/panel"
          className="flex items-center gap-1 text-sm text-texto-sec hover:text-texto"
        >
          <ChevronLeft size={16} />
          Volver
        </Link>
        <span className="text-sm font-semibold text-texto">
          Catálogos y usuarios
        </span>
        <div className="ml-auto">
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <CatalogosAdmin
          catalogos={catalogos ?? []}
          miembrosPorCatalogo={miembrosPorCatalogo}
          superadmins={(perfiles ?? [])
            .filter((p) => p.is_superadmin && p.is_active)
            .map((p) => p.email)
            .filter((e): e is string => !!e)}
        />
      </main>
    </div>
  );
}
