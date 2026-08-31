import Link from "next/link";
import { ActionBadge } from "@/components/audit/ActionBadge";
import { ETIQUETA_ENTIDAD } from "@/lib/constants";
import { tiempoRelativo } from "@/lib/format";

export type CambioReciente = {
  id: string;
  entity_type: string;
  action: string;
  summary: string | null;
  actor_email: string | null;
  product_id: string | null;
  product_name?: string | null;
  created_at: string;
};

export function RecentActivity({
  slug,
  cambios,
}: {
  slug: string;
  cambios: CambioReciente[];
}) {
  if (cambios.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-texto-tenue">
        Todavía no hay cambios registrados.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-linea">
      {cambios.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-sm">
          <ActionBadge action={c.action} />
          <span className="text-texto-sec">
            {ETIQUETA_ENTIDAD[c.entity_type] ?? c.entity_type}
          </span>
          {c.product_id && (
            <Link
              href={`/panel/${slug}/productos/${c.product_id}`}
              className="font-medium text-texto hover:text-primario"
            >
              {c.product_name ?? "producto"}
            </Link>
          )}
          {c.summary && <span className="text-texto-tenue">· {c.summary}</span>}
          <span className="ml-auto whitespace-nowrap text-xs text-texto-tenue">
            {c.actor_email ?? "—"} · {tiempoRelativo(c.created_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
