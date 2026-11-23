import { notFound } from "next/navigation";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { resolverCatalogo, puedeEditar, tienePermiso, verificarSesion } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { cargarSesion, listarSesiones } from "@/lib/caja-data";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CajaDetalle } from "@/components/caja/CajaDetalle";
import { AbrirCaja, CerrarCajaBoton, MovimientoCajaBoton } from "@/components/caja/CajaControles";
import { formatearFechaHora, formatearMoneda } from "@/lib/format";

export const metadata = { title: "Caja — Catálogo" };

export default async function CajaPage({ params }: { params: Promise<{ catalogo: string }> }) {
  const { catalogo: slug } = await params;
  const catalogo = await resolverCatalogo(slug);
  if (!puedeEditar(catalogo)) notFound();
  const user = await verificarSesion();
  const supabase = await createClient();
  const esAdminCaja = tienePermiso(catalogo, "caja_admin");

  const { data: abierta } = await supabase
    .from("cash_sessions")
    .select("id")
    .eq("catalog_id", catalogo.id)
    .eq("user_id", user.userId)
    .eq("status", "abierta")
    .maybeSingle();
  const sesion = abierta ? await cargarSesion(catalogo, abierta.id) : null;
  const historial = await listarSesiones(catalogo, esAdminCaja ? undefined : user.userId);
  const delEquipo = historial.filter((h) => h.id !== abierta?.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-texto">Mi caja</h1>
          <p className="mt-1 text-sm text-texto-sec">
            Cada uno cobra con su propia caja y la cierra contando el efectivo.
          </p>
        </div>
        {sesion && (
          <div className="flex flex-wrap gap-2">
            <Link href={`/panel/${slug}/caja/cobrar`}>
              <Button>
                <Wallet size={15} />
                Cobrar a un cliente
              </Button>
            </Link>
            <MovimientoCajaBoton slug={slug} />
            <CerrarCajaBoton slug={slug} sessionId={sesion.id} esperado={sesion.esperado} />
          </div>
        )}
      </div>

      {sesion ? (
        <CajaDetalle slug={slug} sesion={sesion} puedeAnular={esAdminCaja} />
      ) : (
        <Card>
          <CardBody className="space-y-3">
            <p className="text-sm text-texto">
              No tenés una caja abierta. Abrila para empezar a cobrar.
            </p>
            <AbrirCaja slug={slug} />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{esAdminCaja ? "Cajas del equipo" : "Mis cajas anteriores"}</CardTitle>
        </CardHeader>
        <CardBody>
          {delEquipo.length === 0 ? (
            <p className="text-sm text-texto-tenue">Todavía no hay cajas.</p>
          ) : (
            <ul className="divide-y divide-linea text-sm">
              {delEquipo.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/panel/${slug}/caja/${h.id}`}
                    className="flex flex-wrap items-center gap-3 py-2 hover:bg-superficie-sec"
                  >
                    {esAdminCaja && <span className="font-medium text-texto">{h.usuario}</span>}
                    <span className="text-texto-sec">{formatearFechaHora(h.openedAt)}</span>
                    {h.status === "abierta" ? (
                      <Badge tono="info">Abierta</Badge>
                    ) : h.diferencia == null || h.diferencia === 0 ? (
                      <Badge tono="exito">Cerrada sin diferencia</Badge>
                    ) : (
                      <Badge tono="alerta">
                        {h.diferencia > 0 ? "Sobrante" : "Faltante"} {formatearMoneda(Math.abs(h.diferencia))}
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
