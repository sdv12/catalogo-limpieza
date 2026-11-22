import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { resolverCatalogo, esAdminCatalogo } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ChannelKeys, type ClaveFila } from "@/components/ventas/ChannelKeys";

export const metadata = { title: "Canales de venta — Catálogo" };

const EJEMPLO = `POST /api/pedidos
Authorization: Bearer <clave del canal>
Content-Type: application/json

{
  "referencia": "WEB-10234",
  "cliente": {
    "nombre": "Juana Pérez",
    "telefono": "+54 351 555-1234",
    "email": "juana@mail.com",
    "direccion": "Av. Colón 1234, Córdoba"
  },
  "notas": "Entregar por la tarde",
  "items": [
    { "sku": "LAV-5L", "cantidad": 2 },
    { "sku": "DET-750", "cantidad": 6 }
  ]
}`;

export default async function CanalesPage({
  params,
}: {
  params: Promise<{ catalogo: string }>;
}) {
  const { catalogo: slug } = await params;
  const catalogo = await resolverCatalogo(slug);
  if (!esAdminCatalogo(catalogo)) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("channel_keys")
    .select("id, channel, name, key_prefix, is_active, last_used_at, created_at")
    .eq("catalog_id", catalogo.id)
    .order("created_at");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href={`/panel/${slug}/ventas`}
        className="inline-flex items-center gap-1 text-sm text-texto-sec hover:text-texto"
      >
        <ChevronLeft size={16} />
        Ventas
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-texto">Canales de venta</h1>
        <p className="mt-1 text-sm text-texto-sec">
          Cada tienda online y el bot de WhatsApp usan su propia clave para cargar pedidos
          en la bandeja de Ventas. Entran como <strong>Nuevo</strong>, al precio general, y
          no tocan stock ni deuda hasta que alguien del panel los confirma.
        </p>
      </div>

      <ChannelKeys slug={slug} claves={(data ?? []) as ClaveFila[]} />

      <Card>
        <CardHeader>
          <CardTitle>Para el desarrollador de la tienda o del bot</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-texto-sec">
          <p>
            La llamada se hace <strong className="text-texto">desde el servidor</strong> (backend
            de la tienda o n8n), nunca desde el navegador: la clave no puede quedar a la vista.
          </p>
          <pre className="overflow-x-auto rounded-comp-sm bg-superficie-sec p-3 font-mono text-xs text-texto">
            {EJEMPLO}
          </pre>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Los precios los calcula el panel: si el pedido manda precios, se ignoran.
            </li>
            <li>
              <code>referencia</code> evita duplicados: si se reenvía el mismo pedido, devuelve el
              que ya existe.
            </li>
            <li>
              Respuesta: <code>{`{ "id", "numero", "estado", "total", "duplicado" }`}</code>. Errores:
              401 clave inválida, 400 datos inválidos (con el detalle).
            </li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
