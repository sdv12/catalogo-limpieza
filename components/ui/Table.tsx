import type { HTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function TableWrap({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "tabla-scroll rounded-comp border border-linea bg-superficie",
        className,
      )}
      {...props}
    />
  );
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full border-collapse text-sm", className)}
      {...props}
    />
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b border-linea px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-texto-sec",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("border-b border-linea px-3 py-2 align-middle", className)}
      {...props}
    />
  );
}

export function EmptyState({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-comp border border-dashed border-linea-fuerte bg-superficie px-6 py-12 text-center">
      <p className="text-sm font-medium text-texto">{titulo}</p>
      {descripcion && (
        <p className="max-w-sm text-sm text-texto-sec">{descripcion}</p>
      )}
      {children}
    </div>
  );
}
