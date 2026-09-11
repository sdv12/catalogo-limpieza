import { notFound } from "next/navigation";
import { resolverCatalogo, esAdminCatalogo } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { UsersManager, type MiembroCatalogo } from "@/components/users/UsersManager";

export const metadata = { title: "Usuarios — Catálogo" };

export default async function UsuariosPage({
  params,
}: {
  params: Promise<{ catalogo: string }>;
}) {
  const { catalogo: slug } = await params;
  const catalogo = await resolverCatalogo(slug);
  if (!esAdminCatalogo(catalogo)) notFound();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: miembros } = await supabase
    .from("catalog_members")
    .select("user_id, role")
    .eq("catalog_id", catalogo.id);

  const ids = (miembros ?? []).map((m) => m.user_id);
  const { data: perfiles } = ids.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", ids)
    : { data: [] };
  const perfilPorId = new Map((perfiles ?? []).map((p) => [p.id, p]));

  const filas: MiembroCatalogo[] = (miembros ?? [])
    .map((m) => {
      const p = perfilPorId.get(m.user_id);
      return {
        user_id: m.user_id,
        role: m.role as MiembroCatalogo["role"],
        email: p?.email ?? null,
        full_name: p?.full_name ?? null,
      };
    })
    .sort((a, b) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "", "es"));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-texto">Usuarios</h1>
        <p className="mt-1 text-sm text-texto-sec">
          Quién tiene acceso a {catalogo.name} y qué puede hacer.
        </p>
      </div>
      <UsersManager slug={slug} miembros={filas} miUserId={user?.id ?? null} />
    </div>
  );
}
