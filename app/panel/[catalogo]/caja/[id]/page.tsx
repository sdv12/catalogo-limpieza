import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { resolverCatalogo, puedeEditar, tienePermiso, verificarSesion } from "@/lib/dal";
import { cargarSesion } from "@/lib/caja-data";
import { CajaDetalle } from "@/components/caja/CajaDetalle";
import { CerrarCajaBoton } from "@/components/caja/CajaControles";

export const metadata = { title: "Caja — Catálogo" };

export default async function SesionCajaPage({
  params,
}: {
  params: Promise<{ catalogo: string; id: string }>;
}) {
  const { catalogo: slug, id } = await params;
  const catalogo = await resolverCatalogo(slug);
  if (!puedeEditar(catalogo)) notFound();
  const user = await verificarSesion();
  // RLS: solo la propia o con caja_admin
  const sesion = await cargarSesion(catalogo, id);
  if (!sesion) notFound();
  const esAdminCaja = tienePermiso(catalogo, "caja_admin");

  return (
    <div className="space-y-5">
      <Link
        href={`/panel/${slug}/caja`}
        className="inline-flex items-center gap-1 text-sm text-texto-sec hover:text-texto"
      >
        <ChevronLeft size={16} />
        Caja
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-texto">Caja de {sesion.usuario}</h1>
        {sesion.status === "abierta" && (esAdminCaja || sesion.userId === user.userId) && (
          <CerrarCajaBoton
            slug={slug}
            sessionId={sesion.id}
            esperado={sesion.esperado}
            ajena={sesion.userId !== user.userId}
          />
        )}
      </div>
      <CajaDetalle slug={slug} sesion={sesion} puedeAnular={esAdminCaja} />
    </div>
  );
}
