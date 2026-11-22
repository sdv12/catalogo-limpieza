import { obtenerPerfil, resolverCatalogo } from "@/lib/dal";
import { facturacionHabilitada } from "@/lib/facturacion/tusfacturas";
import { CatalogShell } from "@/components/layout/CatalogShell";
import { createClient } from "@/lib/supabase/server";

export default async function CatalogoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ catalogo: string }>;
}) {
  const { catalogo: slug } = await params;
  const [perfil, catalogo] = await Promise.all([
    obtenerPerfil(),
    resolverCatalogo(slug),
  ]);
  const supabase = await createClient();
  const { count: pedidosNuevos } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("catalog_id", catalogo.id)
    .eq("status", "nuevo");

  return (
    <CatalogShell
      slug={catalogo.slug}
      nombreCatalogo={catalogo.name}
      usuario={perfil.full_name || perfil.email || "Usuario"}
      rol={catalogo.rol}
      permisos={catalogo.permisos}
      facturacionPendiente={!facturacionHabilitada()}
      pedidosNuevos={pedidosNuevos ?? 0}
    >
      {children}
    </CatalogShell>
  );
}
