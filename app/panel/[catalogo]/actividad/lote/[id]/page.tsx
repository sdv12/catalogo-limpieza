import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { resolverCatalogo } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TableWrap, Table, Th, Td } from "@/components/ui/Table";
import { formatearFechaHora } from "@/lib/format";

const ESTADO: Record<string, { label: string; tono: Parameters<typeof Badge>[0]["tono"] }> = {
  completed: { label: "Completada", tono: "exito" },
  partial: { label: "Parcial", tono: "alerta" },
  failed: { label: "Fallida", tono: "error" },
  previewed: { label: "Sin confirmar", tono: "neutro" },
};

type FilaReporte = {
  base_sku?: string;
  rows?: number[];
  ok?: boolean;
  errors?: string[];
};

export default async function LoteImportPage({
  params,
}: {
  params: Promise<{ catalogo: string; id: string }>;
}) {
  const { catalogo: slug, id } = await params;
  const catalogo = await resolverCatalogo(slug);
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("import_batches")
    .select("*")
    .eq("id", id)
    .eq("catalog_id", catalogo.id)
    .maybeSingle();
  if (!batch) notFound();

  const { data: cambios, count } = await supabase
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", id);
  void cambios;

  const reporte = (
    Array.isArray(batch.report) ? batch.report : []
  ) as FilaReporte[];
  const estado = ESTADO[batch.status] ?? ESTADO.previewed;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href={`/panel/${slug}/actividad`}
        className="inline-flex items-center gap-1 text-sm text-texto-sec hover:text-texto"
      >
        <ChevronLeft size={16} />
        Actividad
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-texto">Importación en lote</h1>
        <p className="mt-1 text-sm text-texto-sec">
          {batch.filename ?? "archivo"} · {formatearFechaHora(batch.created_at)}
        </p>
      </div>

      <Card>
        <CardBody className="flex flex-wrap gap-3">
          <Badge tono={estado.tono}>{estado.label}</Badge>
          <Badge tono="neutro">{batch.total_rows} filas</Badge>
          <Badge tono="exito">{batch.ok_rows} importadas</Badge>
          {batch.error_rows > 0 && (
            <Badge tono="error">{batch.error_rows} con error</Badge>
          )}
          {typeof count === "number" && (
            <Badge tono="primario">{count} cambios auditados</Badge>
          )}
        </CardBody>
      </Card>

      {reporte.length > 0 && (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>SKU base</Th>
                <Th>Filas</Th>
                <Th>Resultado</Th>
              </tr>
            </thead>
            <tbody>
              {reporte.map((r, i) => (
                <tr key={i}>
                  <Td className="font-mono text-xs">{r.base_sku ?? "—"}</Td>
                  <Td className="text-texto-tenue">{(r.rows ?? []).join(", ")}</Td>
                  <Td>
                    {r.ok ? (
                      <Badge tono="exito">OK</Badge>
                    ) : (
                      <span className="text-xs text-error">
                        {(r.errors ?? []).join("; ")}
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      <Link
        href={`/panel/${slug}/actividad?lote=${batch.id}`}
        className="inline-block text-sm font-medium text-primario hover:underline"
      >
        Ver los cambios de esta importación en la actividad
      </Link>
    </div>
  );
}
