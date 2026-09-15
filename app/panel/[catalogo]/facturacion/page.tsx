import { notFound } from "next/navigation";
import { CheckCircle2, CircleDashed, ExternalLink } from "lucide-react";
import { resolverCatalogo, esAdminCatalogo } from "@/lib/dal";
import { facturacionHabilitada } from "@/lib/facturacion/tusfacturas";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const metadata = { title: "Facturación — Catálogo" };

const PASOS = [
  {
    titulo: "Crear la cuenta en TusFacturasAPP",
    detalle:
      "En tusfacturas.app, con el CUIT y la razón social del negocio. Ahí se contrata el plan de API.",
  },
  {
    titulo: "Delegar el enlace con AFIP/ARCA",
    detalle:
      "Se hace desde la cuenta de TusFacturasAPP (clave fiscal o el método que pidan). Ellos manejan el certificado — acá no hace falta generar ni cargar ningún certificado.",
  },
  {
    titulo: "Configurar los puntos de venta",
    detalle: "Cada punto de venta habilitado en AFIP se da de alta ahí, dentro de su panel.",
  },
  {
    titulo: "Pasar las 3 credenciales de la API",
    detalle:
      "Se generan en Mi Espacio de Trabajo → Puntos de Venta: apitoken, apikey y usertoken. Se cargan como variables de entorno del panel (nunca en el código) y se activa solo.",
  },
];

export default async function FacturacionPage({
  params,
}: {
  params: Promise<{ catalogo: string }>;
}) {
  const { catalogo: slug } = await params;
  const catalogo = await resolverCatalogo(slug);
  if (!esAdminCatalogo(catalogo)) notFound();

  const habilitada = facturacionHabilitada();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-texto">Facturación electrónica</h1>
        <p className="mt-1 text-sm text-texto-sec">
          Emisión de comprobantes AFIP/ARCA vía TusFacturasAPP.
        </p>
      </div>

      <Card>
        <CardBody className="flex items-center gap-3">
          {habilitada ? (
            <CheckCircle2 size={22} className="shrink-0 text-exito" />
          ) : (
            <CircleDashed size={22} className="shrink-0 text-alerta" />
          )}
          <div className="flex-1">
            <p className="font-medium text-texto">
              {habilitada ? "Conectada" : "Todavía no está conectada"}
            </p>
            <p className="text-sm text-texto-sec">
              {habilitada
                ? "Las credenciales están cargadas. Ya se puede emitir comprobantes."
                : "Faltan las credenciales de TusFacturasAPP. Hasta que se carguen, no se pueden emitir comprobantes."}
            </p>
          </div>
          <Badge tono={habilitada ? "exito" : "alerta"}>
            {habilitada ? "Activa" : "Pendiente"}
          </Badge>
        </CardBody>
      </Card>

      {!habilitada && (
        <Card>
          <CardHeader>
            <CardTitle>Qué falta para activarla</CardTitle>
          </CardHeader>
          <CardBody>
            <ol className="space-y-4">
              {PASOS.map((p, i) => (
                <li key={p.titulo} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-superficie-sec text-xs font-semibold text-texto-sec">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-texto">{p.titulo}</p>
                    <p className="text-sm text-texto-sec">{p.detalle}</p>
                  </div>
                </li>
              ))}
            </ol>
            <a
              href="https://developers.tusfacturas.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primario hover:underline"
            >
              Documentación de TusFacturasAPP
              <ExternalLink size={13} />
            </a>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <p className="text-sm text-texto-sec">
            Facturar todavía no tiene desde dónde dispararse: es parte del futuro módulo de{" "}
            <strong className="text-texto">Ventas</strong>, que va a permitir elegir cliente
            y productos y emitir el comprobante directo desde ahí. Esta pantalla es solo el
            estado de la conexión.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
