"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirPermiso, type ResultadoAccion } from "@/lib/guards";
import type { FilaImport } from "@/lib/import/parse";

export type ReporteImport = {
  summary: { total: number; ok: number; error: number };
  rows: {
    _row?: number;
    ok: boolean;
    errors: string[];
    name?: string | null;
    sku?: string | null;
    base_sku?: string | null;
    rows?: number[];
  }[];
  batch_id: string | null;
};

export async function previsualizarImport(
  slug: string,
  filas: FilaImport[],
): Promise<ResultadoAccion & { data?: ReporteImport }> {
  const catalogo = await exigirPermiso(slug, "carga_masiva");
  if (filas.length === 0) return { ok: false, message: "El archivo no tiene filas." };
  if (filas.length > 2000)
    return { ok: false, message: "Máximo 2000 filas por importación." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("run_import", {
    p_catalog_id: catalogo.id,
    p_rows: filas as unknown as never,
    p_dry_run: true,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "", data: data as unknown as ReporteImport };
}

export async function ejecutarImport(
  slug: string,
  filas: FilaImport[],
  filename: string,
): Promise<ResultadoAccion & { data?: ReporteImport }> {
  const catalogo = await exigirPermiso(slug, "carga_masiva");
  if (filas.length === 0) return { ok: false, message: "No hay filas válidas para importar." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("run_import", {
    p_catalog_id: catalogo.id,
    p_rows: filas as unknown as never,
    p_filename: filename,
    p_dry_run: false,
  });
  if (error) return { ok: false, message: error.message };

  const reporte = data as unknown as ReporteImport;
  revalidatePath(`/panel/${slug}/productos`);
  revalidatePath(`/panel/${slug}`);
  revalidatePath(`/panel/${slug}/actividad`);
  return {
    ok: true,
    message: `Importados ${reporte.summary.ok} · ${reporte.summary.error} con error`,
    data: reporte,
  };
}
