import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-comp-sm bg-superficie-sec",
        className,
      )}
    />
  );
}

/** Esqueleto genérico para páginas de listado (encabezado + filtros + tabla). */
export function ListSkeleton({ filas = 8 }: { filas?: number }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="rounded-comp border border-linea">
        <Skeleton className="h-10 w-full rounded-b-none" />
        {Array.from({ length: filas }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-12 w-full rounded-none border-t border-linea"
          />
        ))}
      </div>
    </div>
  );
}
