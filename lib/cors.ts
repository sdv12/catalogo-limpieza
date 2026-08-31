/**
 * Cabeceras CORS para la API pública.
 * PUBLIC_API_ALLOWED_ORIGINS: lista separada por comas de orígenes permitidos
 * (dominios de las landings). "*" permite cualquiera (datos públicos de solo lectura).
 */
export function corsHeaders(origin: string | null): Record<string, string> {
  const config = (process.env.PUBLIC_API_ALLOWED_ORIGINS ?? "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let allow = "";
  if (config.includes("*")) {
    allow = "*";
  } else if (origin && config.includes(origin)) {
    allow = origin;
  } else if (config.length > 0) {
    allow = config[0];
  }

  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

export function jsonPublico(
  data: unknown,
  origin: string | null,
  init?: { status?: number; maxAge?: number },
) {
  return Response.json(data, {
    status: init?.status ?? 200,
    headers: {
      ...corsHeaders(origin),
      "cache-control": `public, s-maxage=${init?.maxAge ?? 120}, stale-while-revalidate=600`,
    },
  });
}
