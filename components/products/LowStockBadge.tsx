import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export function LowStockBadge({ className }: { className?: string }) {
  return (
    <Badge tono="alerta" className={className}>
      <AlertTriangle size={12} />
      Stock bajo
    </Badge>
  );
}
