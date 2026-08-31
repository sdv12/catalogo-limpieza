import { obtenerPerfil } from "@/lib/dal";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Guard de sesión para todo /panel. El shell (sidebar/topbar) lo agrega
  // cada sección: el selector y /panel/catalogos tienen header propio;
  // /panel/[catalogo] usa CatalogShell.
  await obtenerPerfil();
  return <>{children}</>;
}
