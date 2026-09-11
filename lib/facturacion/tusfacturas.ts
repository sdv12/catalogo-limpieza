import "server-only";

/**
 * Cliente para TusFacturasAPP (https://developers.tusfacturas.app) — wrapper
 * de facturación electrónica ARCA/AFIP. Ellos manejan el certificado y el
 * enlace con AFIP; acá solo hace falta pegarle a su REST API con 3 tokens
 * que se generan en su panel (Mi Espacio de Trabajo → Puntos de Venta):
 *
 *   TUSFACTURAS_API_TOKEN   (apitoken, alfanumérico)
 *   TUSFACTURAS_API_KEY     (apikey, numérico — identifica la empresa)
 *   TUSFACTURAS_USER_TOKEN  (usertoken, alfanumérico)
 *
 * TODAVÍA NO HAY CUENTA CREADA (2026-09). Esto es el andamiaje: valida que
 * las credenciales estén cargadas y deja el punto de entrada listo. Los
 * endpoints concretos (alta de factura, remito, consulta de CUIT, etc.) se
 * terminan de mapear contra la documentación real cuando haya cuenta y se
 * arranque el módulo de Ventas — no está inventado acá para no encajar mal
 * con el contrato real de la API.
 */

export type CredencialesTusFacturas = {
  apitoken: string;
  apikey: string;
  usertoken: string;
};

// La documentación pública no confirma la URL base exacta de la API.
// Se toma de TUSFACTURAS_BASE_URL (env) hasta confirmarla contra la cuenta
// real o la doc completa — no la doy por buena "a ojo".
const BASE_URL = process.env.TUSFACTURAS_BASE_URL ?? "";

export function credencialesTusFacturas(): CredencialesTusFacturas | null {
  const apitoken = process.env.TUSFACTURAS_API_TOKEN;
  const apikey = process.env.TUSFACTURAS_API_KEY;
  const usertoken = process.env.TUSFACTURAS_USER_TOKEN;
  if (!apitoken || !apikey || !usertoken) return null;
  return { apitoken, apikey, usertoken };
}

export function facturacionHabilitada(): boolean {
  return credencialesTusFacturas() != null;
}

/**
 * POST genérico a TusFacturasAPP con las credenciales incluidas en el body,
 * como pide su documentación. Usar cuando se mapeen los endpoints reales
 * (ej. "/facturacion/nuevo", "/remitos/nuevo" — confirmar contra la doc
 * antes de dar por buenos los paths).
 */
export async function tusFacturasFetch<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const cred = credencialesTusFacturas();
  if (!cred) {
    throw new Error(
      "TusFacturasAPP no está configurado (faltan TUSFACTURAS_API_TOKEN/API_KEY/USER_TOKEN)",
    );
  }
  if (!BASE_URL) {
    throw new Error("Falta TUSFACTURAS_BASE_URL (confirmar contra la cuenta/doc real)");
  }
  const r = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...cred, ...body }),
  });
  if (!r.ok) {
    throw new Error(`TusFacturasAPP ${path} → ${r.status}: ${await r.text()}`);
  }
  return r.json() as Promise<T>;
}
