import { type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { corsHeaders, jsonPublico } from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ catalogo: string }> },
) {
  const origin = req.headers.get("origin");
  const { catalogo } = await params;

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("storefront_meta", {
    p_catalog_slug: catalogo,
  });

  if (error) {
    return jsonPublico({ error: "No se pudo obtener el catálogo" }, origin, {
      status: 502,
    });
  }
  if (!data) {
    return jsonPublico({ error: "Catálogo no encontrado" }, origin, { status: 404 });
  }

  return jsonPublico(data, origin, { maxAge: 300 });
}
