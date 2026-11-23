import { Footer } from "@/components/layout/Footer";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Settings, Store } from "lucide-react";
import { obtenerPerfil, catalogosDelUsuario } from "@/lib/dal";
import { PanelTopbar } from "@/components/layout/PanelTopbar";
import { TarjetaCatalogo } from "@/components/catalogs/TarjetaCatalogo";
import { Card } from "@/components/ui/Card";

export default async function SelectorCatalogoPage() {
  const perfil = await obtenerPerfil();
  const catalogos = await catalogosDelUsuario();
  const ecommerce = catalogos.filter((c) => c.kind === "ecommerce");
  const sucursales = catalogos.filter((c) => c.kind === "sucursal");

  // Cada uno ve solo lo que tiene asignado. Con un solo lugar, entra directo.
  if (!perfil.is_superadmin) {
    if (catalogos.length === 1) redirect(`/panel/${catalogos[0].slug}`);
    if (ecommerce.length === 0 && sucursales.length > 1) redirect("/panel/sucursales");
  }
  const mostrarSucursales = sucursales.length > 0 || perfil.is_superadmin;

  return (
    <div className="flex min-h-screen flex-col">
      <PanelTopbar usuario={perfil.full_name || perfil.email || "Usuario"} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-xl font-semibold text-texto">¿A dónde querés entrar?</h1>
        <p className="mt-1 text-sm text-texto-sec">
          Cada tienda online y cada sucursal tiene sus propios productos, precios, stock y equipo.
        </p>

        {catalogos.length === 0 && !perfil.is_superadmin ? (
          <Card className="mt-6 p-6 text-sm text-texto-sec">
            Todavía no tenés acceso a ningún lugar. Pedile a un administrador que te agregue.
          </Card>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {ecommerce.map((c) => (
              <TarjetaCatalogo key={c.id} catalogo={c} />
            ))}
            {mostrarSucursales && (
              <Link href="/panel/sucursales">
                <Card className="flex h-full items-center gap-4 p-5 transition-colors hover:border-primario">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-comp bg-superficie-sec text-texto-sec">
                    <Store size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-texto">Sucursales</span>
                    <span className="mt-0.5 block text-xs text-texto-tenue">
                      {sucursales.length === 0
                        ? "Todavía no hay sucursales"
                        : sucursales.length === 1
                          ? "1 sucursal"
                          : `${sucursales.length} sucursales`}
                    </span>
                  </span>
                  <ChevronRight size={18} className="text-texto-tenue" />
                </Card>
              </Link>
            )}
          </div>
        )}

        {perfil.is_superadmin && (
          <Link
            href="/panel/catalogos"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primario hover:underline"
          >
            <Settings size={16} />
            Administrar tiendas, sucursales y usuarios
          </Link>
        )}
      </main>
      <Footer />
    </div>
  );
}
