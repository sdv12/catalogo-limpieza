import { ArrowRight } from "lucide-react";
import {
  ETIQUETA_CAMPO,
  campoVisible,
  formatearValorAuditoria,
  parsearCambios,
  type MapasAuditoria,
} from "@/lib/audit-format";

export function DiffView({
  changes,
  maps,
  accion,
}: {
  changes: unknown;
  maps?: MapasAuditoria;
  accion: string;
}) {
  const visibles = parsearCambios(changes).filter(campoVisible);

  if (visibles.length === 0) {
    return (
      <p className="text-xs text-texto-tenue">
        {accion === "delete"
          ? "El registro fue dado de baja."
          : accion === "restore"
            ? "El registro fue reactivado."
            : "Sin cambios de campos registrados."}
      </p>
    );
  }

  const esAlta = accion === "create" || accion === "duplicate";

  return (
    <ul className="space-y-1 text-xs">
      {visibles.map((c, i) => (
        <li key={i} className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-texto-sec">
            {ETIQUETA_CAMPO[c.field] ?? c.field}:
          </span>
          {!esAlta && (
            <>
              <span className="rounded bg-error-suave px-1 text-error line-through">
                {formatearValorAuditoria(c.field, c.old, maps)}
              </span>
              <ArrowRight size={11} className="text-texto-tenue" />
            </>
          )}
          <span className="rounded bg-exito-suave px-1 text-exito">
            {formatearValorAuditoria(c.field, c.new, maps)}
          </span>
        </li>
      ))}
    </ul>
  );
}
