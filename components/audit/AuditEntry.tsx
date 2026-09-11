import Link from "next/link";
import { ChevronDown, Layers } from "lucide-react";
import { ActionBadge } from "@/components/audit/ActionBadge";
import { DiffView } from "@/components/audit/DiffView";
import { ETIQUETA_ENTIDAD } from "@/lib/constants";
import { formatearFechaHora, tiempoRelativo } from "@/lib/format";
import type { MapasAuditoria } from "@/lib/audit-format";

export type EntradaAuditoria = {
  id: string;
  entity_type: string;
  action: string;
  changes: unknown;
  summary: string | null;
  actor_email: string | null;
  product_id: string | null;
  batch_id: string | null;
  created_at: string;
};

export function AuditEntry({
  entrada,
  slug,
  nombreProducto,
  mostrarProducto = false,
  maps,
}: {
  entrada: EntradaAuditoria;
  slug: string;
  nombreProducto?: string | null;
  mostrarProducto?: boolean;
  maps?: MapasAuditoria;
}) {
  const esBaja = entrada.action === "delete";
  return (
    <details className="group border-b border-linea last:border-0">
      <summary
        className={`flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 py-2.5 marker:hidden ${
          esBaja ? "opacity-55" : ""
        }`}
      >
        <ActionBadge action={entrada.action} />
        <span className="text-sm text-texto-sec">
          {ETIQUETA_ENTIDAD[entrada.entity_type] ?? entrada.entity_type}
        </span>
        {mostrarProducto && entrada.product_id && (
          <Link
            href={`/panel/${slug}/productos/${entrada.product_id}`}
            className="text-sm font-medium text-texto hover:text-primario"
          >
            {nombreProducto ?? "producto"}
          </Link>
        )}
        {entrada.summary && (
          <span className="text-xs text-texto-tenue">· {entrada.summary}</span>
        )}
        {entrada.batch_id && (
          <Link
            href={`/panel/${slug}/actividad/lote/${entrada.batch_id}`}
            className="inline-flex items-center gap-1 text-xs text-texto-tenue hover:text-primario"
          >
            <Layers size={12} /> en lote
          </Link>
        )}
        <span
          className="ml-auto whitespace-nowrap text-xs text-texto-tenue"
          title={formatearFechaHora(entrada.created_at)}
        >
          {entrada.actor_email ?? "—"} · {tiempoRelativo(entrada.created_at)}
        </span>
        <ChevronDown
          size={14}
          className="text-texto-tenue transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="pb-3 pl-1 pt-1">
        <DiffView changes={entrada.changes} maps={maps} accion={entrada.action} />
        <p className="mt-1 text-[11px] text-texto-tenue">
          {formatearFechaHora(entrada.created_at)}
        </p>
      </div>
    </details>
  );
}
