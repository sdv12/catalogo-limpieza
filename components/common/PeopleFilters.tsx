"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui/Field";

/** Filtros de listado para Clientes y Proveedores (búsqueda + estado + eliminados). */
export function PeopleFilters({
  placeholder,
  valores,
}: {
  placeholder: string;
  valores: { q: string; estado: string; eliminados: boolean };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(valores.q);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const setParam = (cambios: Record<string, string>) => {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    p.delete("page");
    startTransition(() => router.replace(`${pathname}?${p.toString()}`));
  };

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      if (q.trim() !== valores.q) setParam({ q: q.trim() });
    }, 350);
    return () => clearTimeout(debounce.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const buscarYa = () => {
    clearTimeout(debounce.current);
    if (q.trim() !== valores.q) setParam({ q: q.trim() });
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="relative min-w-52 flex-1">
        <Search
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-tenue"
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              buscarYa();
            }
          }}
          placeholder={placeholder}
          className="pl-8"
          aria-label="Buscar"
        />
      </div>

      <Select
        value={valores.estado}
        onChange={(e) => setParam({ estado: e.target.value })}
        aria-label="Estado"
        className="w-36"
      >
        <option value="">Todos</option>
        <option value="activo">Activos</option>
        <option value="inactivo">Inactivos</option>
      </Select>

      <label className="flex h-10 items-center gap-1.5 whitespace-nowrap text-sm text-texto-sec">
        <input
          type="checkbox"
          checked={valores.eliminados}
          onChange={(e) => setParam({ eliminados: e.target.checked ? "1" : "" })}
        />
        Ver eliminados
      </label>
    </div>
  );
}
