import Link from "next/link";
import { ChevronLeft, Settings } from "lucide-react";
import { obtenerPerfil, catalogosDelUsuario } from "@/lib/dal";
import { PanelTopbar } from "@/components/layout/PanelTopbar";
import { Footer } from "@/components/layout/Footer";
import { TarjetaCatalogo } from "@/components/catalogs/TarjetaCatalogo";
import { Card } from "@/components/ui/Card";

export const metadata = { title: "Sucursales" };

export default async function SucursalesPage() {
  const perfil = await obtenerPerfil();
  const catalogos = await catalogosDelUsuario();
  const sucursales = catalogos.filter((c) => c.kind === "sucursal");
  // Si solo tiene sucursales, el inicio lo trae directo acá: no mostrar "volver" a una pantalla que lo redirige.
  const tieneInicio = perfil.is_superadmin || catalogos.some((c) => c.kind === "ecommerce");

  return (
    <div className="flex min-h-screen flex-col">
      <PanelTopbar usuario={perfil.full_name || perfil.email || "Usuario"} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        {tieneInicio && (
          <Link
            href="/panel"
            className="mb-4 inline-flex items-center gap-1 text-sm text-texto-sec hover:text-texto"
          >
            <ChevronLeft size={16} />
            Inicio
          </Link>
        )}
        <h1 className="text-xl font-semibold text-texto">Sucursales</h1>
        <p className="mt-1 text-sm text-texto-sec">
          Cada sucursal es un panel independiente con sus propios productos, precios, clientes,
          stock, ventas y caja.
        </p>

        {sucursales.length === 0 ? (
          <Card className="mt-6 p-6 text-sm text-texto-sec">
            {perfil.is_superadmin
              ? "Todavía no hay sucursales. Creala desde «Administrar tiendas, sucursales y usuarios» eligiendo el tipo Sucursal."
              : "No tenés acceso a ninguna sucursal."}
          </Card>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {sucursales.map((c) => (
              <TarjetaCatalogo key={c.id} catalogo={c} />
            ))}
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
