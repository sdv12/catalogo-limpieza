import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { catalogosDelUsuario, esAdminCatalogo } from "@/lib/dal";
import { emitirComprobanteInputSchema } from "@/lib/validation/facturacion";
import {
  emitirComprobante,
  facturacionHabilitada,
  ErrorTusFacturas,
  ErrorHttpTusFacturas,
} from "@/lib/facturacion/tusfacturas";

/**
 * Emite un comprobante fiscal (factura / nota de crédito / nota de débito)
 * vía TusFacturasAPP. Server-side: las credenciales nunca viajan al cliente.
 *
 * Auth: exige sesión y ser administrador del catálogo indicado en
 * `?catalogo=<slug>`. Facturar es una acción sensible: genera un documento
 * fiscal real que no se puede editar ni borrar, solo anular con NC.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const slug = req.nextUrl.searchParams.get("catalogo");
  if (!slug) {
    return NextResponse.json({ error: "Falta el parámetro catalogo" }, { status: 400 });
  }
  const catalogo = (await catalogosDelUsuario()).find((c) => c.slug === slug);
  if (!catalogo || !esAdminCatalogo(catalogo)) {
    return NextResponse.json(
      { error: "Emitir comprobantes es solo para administradores del catálogo" },
      { status: 403 },
    );
  }

  if (!facturacionHabilitada()) {
    return NextResponse.json(
      {
        error:
          "Facturación electrónica no configurada (faltan las credenciales de TusFacturasAPP)",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido (se espera JSON)" }, { status: 400 });
  }

  const parsed = emitirComprobanteInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Datos inválidos",
        detalle: parsed.error.issues.map((i) => ({
          campo: i.path.join("."),
          mensaje: i.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const resultado = await emitirComprobante(parsed.data);
    return NextResponse.json({
      cae: resultado.cae,
      caeVencimiento: resultado.caeVencimiento,
      numero: resultado.numero,
      puntoVenta: resultado.puntoVenta,
      pdfUrl: resultado.pdfUrl,
      qrTexto: resultado.qrTexto,
    });
  } catch (e) {
    if (e instanceof ErrorTusFacturas) {
      return NextResponse.json({ error: "Rechazado por AFIP/ARCA", errores: e.errores }, { status: 400 });
    }
    if (e instanceof ErrorHttpTusFacturas) {
      const status = e.status === 401 || e.status === 403 ? e.status : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    const mensaje = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
