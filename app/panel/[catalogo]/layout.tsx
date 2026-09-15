import { obtenerPerfil, resolverCatalogo } from "@/lib/dal";
import { facturacionHabilitada } from "@/lib/facturacion/tusfacturas";
import { CatalogShell } from "@/components/layout/CatalogShell";

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

  return (
    <CatalogShell
      slug={catalogo.slug}
      nombreCatalogo={catalogo.name}
      usuario={perfil.full_name || perfil.email || "Usuario"}
      rol={catalogo.rol}
      permisos={catalogo.permisos}
      facturacionPendiente={!facturacionHabilitada()}
    >
      {children}
    </CatalogShell>
  );
}
