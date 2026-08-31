import { Badge } from "@/components/ui/Badge";
import { ETIQUETA_ACCION, type AccionAuditoria } from "@/lib/constants";

const TONO: Record<AccionAuditoria, Parameters<typeof Badge>[0]["tono"]> = {
  create: "exito",
  update: "info",
  delete: "error",
  restore: "primario",
  duplicate: "info",
  stock_adjust: "alerta",
  price_adjust: "alerta",
  bulk_import: "primario",
  bulk_price_update: "primario",
};

export function ActionBadge({ action }: { action: string }) {
  const a = action as AccionAuditoria;
  return <Badge tono={TONO[a] ?? "neutro"}>{ETIQUETA_ACCION[a] ?? action}</Badge>;
}
