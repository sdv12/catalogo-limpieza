import { type NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { columnasImport, generarCSV } from "@/lib/import/template";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("catalogo");
  const formato =
    req.nextUrl.searchParams.get("formato") === "xlsx" ? "xlsx" : "csv";
  if (!slug) return new NextResponse("Falta el catálogo", { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("No autorizado", { status: 401 });

  // RLS: solo devuelve el catálogo si el usuario es miembro
  const { data: cat } = await supabase
    .from("catalogs")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!cat) return new NextResponse("Catálogo no encontrado", { status: 404 });

  const { data: tiers } = await supabase
    .from("price_tiers")
    .select("code, name")
    .eq("catalog_id", cat.id)
    .eq("is_active", true)
    .order("sort_order");

  const cols = columnasImport(tiers ?? []);

  if (formato === "csv") {
    return new NextResponse("﻿" + generarCSV(cols), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="plantilla-productos-${slug}.csv"`,
      },
    });
  }

  const ws = XLSX.utils.aoa_to_sheet([
    cols.map((c) => c.label),
    cols.map((c) => c.ejemplo),
  ]);
  ws["!cols"] = cols.map(() => ({ wch: 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Productos");
  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="plantilla-productos-${slug}.xlsx"`,
    },
  });
}
