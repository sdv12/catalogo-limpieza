import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings, Store } from "lucide-react";
import { obtenerPerfil, catalogosDelUsuario } from "@/lib/dal";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function SelectorCatalogoPage() {
  const perfil = await obtenerPerfil();
  const catalogos = await catalogosDelUsuario();

  // Un solo catálogo y no es superadmin → entra directo.
  if (catalogos.length === 1 && !perfil.is_superadmin) {
    redirect(`/panel/${catalogos[0].slug}`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center border-b border-linea bg-superficie px-4 sm:px-6">
        <span className="text-sm font-semibold text-texto">
          Panel de catálogo
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-texto-sec sm:inline">
            {perfil.full_name || perfil.email}
          </span>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-xl font-semibold text-texto">Elegí un catálogo</h1>
        <p className="mt-1 text-sm text-texto-sec">
          Cada catálogo tiene sus propios productos, precios y stock.
        </p>

        {catalogos.length === 0 ? (
          <Card className="mt-6 p-6 text-sm text-texto-sec">
            Todavía no tenés acceso a ningún catálogo. Pedile a un administrador
            que te agregue.
          </Card>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {catalogos.map((c) => (
              <Link key={c.id} href={`/panel/${c.slug}`}>
                <Card className="flex h-full items-center gap-4 p-5 transition-colors hover:border-primario">
                  <span className="flex size-11 items-center justify-center rounded-comp bg-primario-suave text-primario-fuerte">
                    <Store size={22} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-texto">
                      {c.name}
                    </span>
                    <span className="mt-0.5 block">
                      <Badge tono={c.rol === "viewer" ? "alerta" : "neutro"}>
                        {c.rol === "superadmin"
                          ? "Administrador"
                          : c.rol === "editor"
                            ? "Edición"
                            : "Solo lectura"}
                      </Badge>
                    </span>
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {perfil.is_superadmin && (
          <Link
            href="/panel/catalogos"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primario hover:underline"
          >
            <Settings size={16} />
            Administrar catálogos y usuarios
          </Link>
        )}
      </main>
    </div>
  );
}
