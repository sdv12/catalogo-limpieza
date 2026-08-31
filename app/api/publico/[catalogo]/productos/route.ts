import { type NextRequest } from "next/server";
import { createPublicClient, IMAGENES_BASE } from "@/lib/supabase/public";
import { corsHeaders, jsonPublico } from "@/lib/cors";

export const dynamic = "force-dynamic";

type Producto = {
  imagenes: string[];
  [k: string]: unknown;
};

/** Convierte los storage_path de las imágenes en URLs públicas absolutas. */
function conUrls(productos: Producto[]): Producto[] {
  return productos.map((p) => ({
    ...p,
    imagenes: (p.imagenes ?? []).map((path) => `${IMAGENES_BASE}${encodeURI(path)}`),
  }));
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ catalogo: string }> },
) {
  const origin = req.headers.get("origin");
  const { catalogo } = await params;
  const sp = req.nextUrl.searchParams;

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("storefront_products", {
    p_catalog_slug: catalogo,
    p_q: sp.get("q") || undefined,
    p_category: sp.get("categoria") || undefined,
    p_sku: sp.get("sku") || undefined,
    p_limit: Number(sp.get("limit")) || 60,
    p_offset: Number(sp.get("offset")) || 0,
  });

  if (error) {
    return jsonPublico({ error: "No se pudo obtener el catálogo" }, origin, {
      status: 502,
    });
  }

  const productos = conUrls((data as Producto[]) ?? []);

  // ?sku=... → devuelve el objeto único (o 404)
  if (sp.get("sku")) {
    if (productos.length === 0) {
      return jsonPublico({ error: "Producto no encontrado" }, origin, { status: 404 });
    }
    return jsonPublico(productos[0], origin, { maxAge: 120 });
  }

  return jsonPublico(
    { catalogo, total: productos.length, productos },
    origin,
    { maxAge: 120 },
  );
}
