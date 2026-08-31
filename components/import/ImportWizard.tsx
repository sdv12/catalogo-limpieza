"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TableWrap, Table, Th, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { leerArchivo, normalizarFilas, filtrarValidas, type FilaImport } from "@/lib/import/parse";
import {
  previsualizarImport,
  ejecutarImport,
  type ReporteImport,
} from "@/app/panel/[catalogo]/importar/actions";

type Paso = "subir" | "previsualizar" | "listo";

export function ImportWizard({ slug }: { slug: string }) {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("subir");
  const [filas, setFilas] = useState<FilaImport[]>([]);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [preview, setPreview] = useState<ReporteImport | null>(null);
  const [resultado, setResultado] = useState<ReporteImport | null>(null);
  const [cargando, setCargando] = useState(false);

  async function elegirArchivo(file: File) {
    setCargando(true);
    try {
      const { registros } = await leerArchivo(file);
      const norm = normalizarFilas(registros);
      if (norm.length === 0) {
        toast.error("El archivo no tiene filas de datos.");
        return;
      }
      setFilas(norm);
      setNombreArchivo(file.name);
      const r = await previsualizarImport(slug, norm);
      if (!r.ok || !r.data) {
        toast.error(r.message || "No se pudo validar el archivo");
        return;
      }
      setPreview(r.data);
      setPaso("previsualizar");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo leer el archivo");
    } finally {
      setCargando(false);
    }
  }

  async function confirmar() {
    if (!preview) return;
    const validas = filtrarValidas(
      filas,
      preview.rows.filter((r) => r.ok).map((r) => r._row ?? -1),
    );
    if (validas.length === 0) {
      toast.error("No hay filas válidas para importar.");
      return;
    }
    setCargando(true);
    const r = await ejecutarImport(slug, validas, nombreArchivo);
    setCargando(false);
    if (!r.ok || !r.data) {
      toast.error(r.message);
      return;
    }
    toast.success(r.message);
    setResultado(r.data);
    setPaso("listo");
    router.refresh();
  }

  function reiniciar() {
    setPaso("subir");
    setFilas([]);
    setPreview(null);
    setResultado(null);
    setNombreArchivo("");
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>1 · Plantilla</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-2">
          <a href={`/api/plantilla-importacion?catalogo=${slug}&formato=csv`}>
            <Button variante="secundario" tamano="sm">
              <Download size={14} /> Plantilla CSV
            </Button>
          </a>
          <a href={`/api/plantilla-importacion?catalogo=${slug}&formato=xlsx`}>
            <Button variante="secundario" tamano="sm">
              <Download size={14} /> Plantilla Excel
            </Button>
          </a>
          <p className="mt-1 w-full text-xs text-texto-tenue">
            Una fila por presentación. Filas con el mismo <code>sku_base</code> se
            agrupan como un solo producto. Las categorías deben existir.
          </p>
        </CardBody>
      </Card>

      {paso === "subir" && (
        <Card>
          <CardHeader>
            <CardTitle>2 · Subir archivo</CardTitle>
          </CardHeader>
          <CardBody>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-comp border border-dashed border-linea-fuerte px-6 py-10 text-center hover:border-primario">
              {cargando ? (
                <span className="text-sm text-texto-sec">Procesando…</span>
              ) : (
                <>
                  <Upload size={24} className="text-texto-tenue" />
                  <span className="text-sm font-medium text-texto">
                    Elegí un archivo CSV o Excel
                  </span>
                  <span className="text-xs text-texto-tenue">
                    Se valida antes de importar nada
                  </span>
                </>
              )}
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                disabled={cargando}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) elegirArchivo(f);
                  e.target.value = "";
                }}
              />
            </label>
          </CardBody>
        </Card>
      )}

      {paso === "previsualizar" && preview && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>3 · Vista previa</CardTitle>
            <span className="flex items-center gap-1.5 text-xs">
              <FileSpreadsheet size={13} /> {nombreArchivo}
            </span>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge tono="neutro">{preview.summary.total} filas</Badge>
              <Badge tono="exito">{preview.summary.ok} válidas</Badge>
              {preview.summary.error > 0 && (
                <Badge tono="error">{preview.summary.error} con error</Badge>
              )}
            </div>

            <PreviewTable rows={preview.rows} />

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                onClick={confirmar}
                disabled={cargando || preview.summary.ok === 0}
              >
                {cargando
                  ? "Importando…"
                  : `Importar ${preview.summary.ok} ${preview.summary.ok === 1 ? "producto" : "productos"}`}
              </Button>
              <Button variante="secundario" onClick={reiniciar} disabled={cargando}>
                Cancelar
              </Button>
              {preview.summary.error > 0 && (
                <ExportarErrores rows={preview.rows} nombre={nombreArchivo} />
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {paso === "listo" && resultado && (
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2">
              {resultado.summary.error === 0 ? (
                <CheckCircle2 className="text-exito" size={20} />
              ) : (
                <AlertCircle className="text-alerta" size={20} />
              )}
              <p className="font-medium text-texto">
                {resultado.summary.ok} importados
                {resultado.summary.error > 0
                  ? ` · ${resultado.summary.error} con error`
                  : ""}
              </p>
            </div>

            {resultado.rows.some((r) => !r.ok) && (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>SKU base</Th>
                      <Th>Filas</Th>
                      <Th>Error</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.rows
                      .filter((r) => !r.ok)
                      .map((r, i) => (
                        <tr key={i}>
                          <Td>{r.base_sku}</Td>
                          <Td>{(r.rows ?? []).join(", ")}</Td>
                          <Td className="text-error">{r.errors.join("; ")}</Td>
                        </tr>
                      ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}

            <div className="flex flex-wrap gap-2">
              <Link href={`/panel/${slug}/productos`}>
                <Button>Ver productos</Button>
              </Link>
              {resultado.batch_id && (
                <Link
                  href={`/panel/${slug}/actividad/lote/${resultado.batch_id}`}
                >
                  <Button variante="secundario">Ver detalle de la importación</Button>
                </Link>
              )}
              <Button variante="secundario" onClick={reiniciar}>
                Importar otro archivo
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function PreviewTable({ rows }: { rows: ReporteImport["rows"] }) {
  return (
    <TableWrap className="max-h-96 overflow-y-auto">
      <Table>
        <thead className="sticky top-0 bg-superficie">
          <tr>
            <Th className="w-12">Fila</Th>
            <Th>Producto</Th>
            <Th>SKU</Th>
            <Th>Estado</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={r.ok ? undefined : "bg-error-suave/40"}>
              <Td className="text-texto-tenue">{r._row}</Td>
              <Td>{r.name || "—"}</Td>
              <Td className="font-mono text-xs">{r.sku || "—"}</Td>
              <Td>
                {r.ok ? (
                  <Badge tono="exito">OK</Badge>
                ) : (
                  <span className="text-xs text-error">{r.errors.join("; ")}</span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

function ExportarErrores({
  rows,
  nombre,
}: {
  rows: ReporteImport["rows"];
  nombre: string;
}) {
  function descargar() {
    const conError = rows.filter((r) => !r.ok);
    const csv = [
      "fila,producto,sku,errores",
      ...conError.map(
        (r) =>
          `${r._row},"${(r.name ?? "").replace(/"/g, '""')}",${r.sku ?? ""},"${r.errors
            .join("; ")
            .replace(/"/g, '""')}"`,
      ),
    ].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `errores-${nombre.replace(/\.[^.]+$/, "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Button variante="secundario" onClick={descargar}>
      <Download size={14} /> Descargar errores
    </Button>
  );
}
