import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Cliente, Comprobante } from "@/lib/validation/facturacion";

/**
 * Cliente para TusFacturasAPP (https://developers.tusfacturas.app) — wrapper
 * de facturación electrónica AFIP/ARCA. Ellos manejan el certificado y el
 * enlace con AFIP; acá solo hace falta pegarle a su REST API con 3 tokens
 * que se generan en su panel (Mi Espacio de Trabajo → Puntos de Venta), y
 * van DENTRO del body de cada request (no en headers):
 *
 *   TUSFACTURAS_APITOKEN    (apitoken, alfanumérico)
 *   TUSFACTURAS_APIKEY      (apikey, numérico — identifica la empresa)
 *   TUSFACTURAS_USERTOKEN   (usertoken, alfanumérico)
 *
 * TODAVÍA NO HAY CUENTA CREADA (2026-09). Esto queda armado y listo para
 * prender apenas existan las credenciales: sin ellas, `emitirComprobante`
 * tira un error claro en vez de romper builds/otras rutas.
 */

const BASE_URL = "https://www.tusfacturas.app/app/api/v2";
const BUCKET_COMPROBANTES = "comprobantes-fiscales";

export type CredencialesTusFacturas = {
  apitoken: string;
  apikey: string;
  usertoken: string;
};

export function credencialesTusFacturas(): CredencialesTusFacturas | null {
  const apitoken = process.env.TUSFACTURAS_APITOKEN;
  const apikey = process.env.TUSFACTURAS_APIKEY;
  const usertoken = process.env.TUSFACTURAS_USERTOKEN;
  if (!apitoken || !apikey || !usertoken) return null;
  return { apitoken, apikey, usertoken };
}

export function facturacionHabilitada(): boolean {
  return credencialesTusFacturas() != null;
}

// ------------------------------------------------------------
// Errores propios: distinguen "TusFacturasAPP rechazó los datos"
// (error de negocio, mensaje para el usuario) de una falla de red/HTTP.
// ------------------------------------------------------------
export class ErrorTusFacturas extends Error {
  errores: string[];
  constructor(errores: string[]) {
    super(errores.join(" · ") || "TusFacturasAPP rechazó el comprobante");
    this.name = "ErrorTusFacturas";
    this.errores = errores;
  }
}

export class ErrorHttpTusFacturas extends Error {
  status: number;
  constructor(status: number, body: string) {
    super(`TusFacturasAPP respondió ${status}: ${body.slice(0, 500)}`);
    this.name = "ErrorHttpTusFacturas";
    this.status = status;
  }
}

/**
 * POST con reintento (backoff exponencial) solo ante 429 (rate limit) o 5xx
 * transitorios. 400/401/403/404/405 no se reintentan: son errores del
 * request, no de disponibilidad.
 */
async function postConReintento(
  path: string,
  body: Record<string, unknown>,
  intentos = 3,
): Promise<{ status: number; text: string }> {
  let ultimoError: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await r.text();
      if (r.status === 429 || r.status >= 500) {
        if (i < intentos - 1) {
          await new Promise((res) => setTimeout(res, 500 * 2 ** i));
          continue;
        }
      }
      return { status: r.status, text };
    } catch (e) {
      ultimoError = e;
      if (i < intentos - 1) await new Promise((res) => setTimeout(res, 500 * 2 ** i));
    }
  }
  throw ultimoError instanceof Error ? ultimoError : new Error("Fallo de red hacia TusFacturasAPP");
}

function requerirCredenciales(): CredencialesTusFacturas {
  const cred = credencialesTusFacturas();
  if (!cred) {
    throw new Error(
      "TusFacturasAPP no está configurado (faltan TUSFACTURAS_APITOKEN / TUSFACTURAS_APIKEY / TUSFACTURAS_USERTOKEN)",
    );
  }
  return cred;
}

// ------------------------------------------------------------
// Respuesta de /facturacion/nuevo
// ------------------------------------------------------------
export type RespuestaComprobante = {
  cae: string;
  caeVencimiento: string | null;
  numero: string | null;
  puntoVenta: string | null;
  pdfUrl: string | null;
  qrTexto: string | null;
  /** Respuesta cruda de la API, por si hace falta algún campo no mapeado. */
  raw: Record<string, unknown>;
};

/** La API es flexible con dónde devuelve cada dato; se busca en los lugares esperables. */
function normalizarRespuesta(data: Record<string, unknown>): RespuestaComprobante {
  const comp = (data.comprobante ?? data) as Record<string, unknown>;
  const cae = String(comp.cae ?? data.cae ?? "").trim();
  return {
    cae,
    caeVencimiento: (comp.cae_vencimiento ?? data.cae_vencimiento ?? null) as string | null,
    numero: (comp.numero ?? data.numero ?? null) as string | null,
    puntoVenta: (comp.punto_venta ?? data.punto_venta ?? null) as string | null,
    pdfUrl: (comp.pdf ?? data.pdf ?? data.archivo_pdf ?? null) as string | null,
    qrTexto: (data.qr ?? comp.qr ?? null) as string | null,
    raw: data,
  };
}

/**
 * Emite un comprobante (factura, nota de crédito/débito) de forma
 * instantánea (sincrónica). Tira `ErrorTusFacturas` si la API devuelve
 * `error: "S"`, o `ErrorHttpTusFacturas` ante un status HTTP de error.
 */
export async function emitirComprobante(input: {
  cliente: Cliente;
  comprobante: Comprobante;
}): Promise<RespuestaComprobante> {
  const cred = requerirCredenciales();

  const { status, text } = await postConReintento("/facturacion/nuevo", {
    ...cred,
    cliente: input.cliente,
    comprobante: input.comprobante,
  });

  if (status === 401 || status === 403) {
    throw new ErrorHttpTusFacturas(status, "Acceso denegado — revisar apitoken/apikey/usertoken");
  }
  if (status === 404) throw new ErrorHttpTusFacturas(status, "Recurso inexistente");
  if (status === 405) throw new ErrorHttpTusFacturas(status, "Método no permitido");
  if (status >= 400) throw new ErrorHttpTusFacturas(status, text);

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ErrorHttpTusFacturas(status, `Respuesta no-JSON: ${text.slice(0, 300)}`);
  }

  if (data.error === "S") {
    const errores = Array.isArray(data.errores)
      ? data.errores.map(String)
      : [String(data.errores ?? "Error desconocido de TusFacturasAPP")];
    throw new ErrorTusFacturas(errores);
  }

  return normalizarRespuesta(data);
}

/**
 * Modo asincrónico (cola + webhook) para facturar en volumen sin bloquear
 * la respuesta al usuario. PENDIENTE: confirmar contra la documentación
 * completa el/los parámetro(s) exacto(s) que activan la cola (ej. un flag
 * de tipo "async"/"diferido") y la URL de configuración del webhook — la
 * doc pública no los detalla. `external_reference` sí está confirmado:
 * viaja en el payload y vuelve en el webhook para poder linkear el
 * comprobante emitido con el registro propio (venta, pedido, etc.).
 */
export async function emitirComprobanteAsync(input: {
  cliente: Cliente;
  comprobante: Comprobante;
  externalReference: string;
}): Promise<{ encolado: boolean; raw: Record<string, unknown> }> {
  const cred = requerirCredenciales();
  const { status, text } = await postConReintento("/facturacion/nuevo", {
    ...cred,
    cliente: input.cliente,
    comprobante: input.comprobante,
    external_reference: input.externalReference,
    // TODO: agregar acá el flag real de "modo asincrónico" cuando se
    // confirme contra la documentación completa / soporte de TusFacturasAPP.
  });
  if (status >= 400) throw new ErrorHttpTusFacturas(status, text);
  const data = JSON.parse(text) as Record<string, unknown>;
  if (data.error === "S") {
    const errores = Array.isArray(data.errores) ? data.errores.map(String) : [String(data.errores)];
    throw new ErrorTusFacturas(errores);
  }
  return { encolado: true, raw: data };
}

/**
 * Descarga el PDF del comprobante (la URL que devuelve la API es temporal,
 * válida solo el día de la consulta) y lo guarda en Storage, privado.
 * Devuelve el storage_path guardado.
 */
export async function guardarComprobantePdf(
  pdfUrl: string,
  storagePath: string,
): Promise<string> {
  const r = await fetch(pdfUrl);
  if (!r.ok) {
    throw new Error(`No se pudo descargar el PDF del comprobante (${r.status})`);
  }
  const bytes = await r.arrayBuffer();
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET_COMPROBANTES)
    .upload(storagePath, bytes, { contentType: "application/pdf", upsert: true });
  if (error) throw error;
  return storagePath;
}
