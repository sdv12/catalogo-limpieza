"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Input, Select } from "@/components/ui/Field";

/**
 * Escribe/borra parámetros en la URL sin recargar y resetea la paginación.
 * Base común de todos los filtros del panel.
 */
function useSetParam() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (cambios: Record<string, string>) => {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    p.delete("page");
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };
}

/**
 * Buscador ligado a un parámetro de la URL. Escribe con debounce, Enter
 * dispara al instante, Escape / la X limpian. Es la misma pieza en Productos,
 * Clientes, Proveedores, etc.
 */
export function BuscadorUrl({
  param = "q",
  placeholder,
  className,
}: {
  param?: string;
  placeholder: string;
  className?: string;
}) {
  const searchParams = useSearchParams();
  const setParam = useSetParam();
  const externo = searchParams.get(param) ?? "";

  const [valor, setValor] = useState(externo);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ultimo = useRef(externo);

  // Si el parámetro cambia por fuera (reset de filtros, navegación) sincroniza.
  useEffect(() => {
    if (externo !== ultimo.current) {
      ultimo.current = externo;
      setValor(externo);
    }
  }, [externo]);

  const aplicar = (v: string) => {
    const t = v.trim();
    ultimo.current = t;
    setParam({ [param]: t });
  };

  const onChange = (v: string) => {
    setValor(v);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => aplicar(v), 350);
  };

  const limpiar = () => {
    clearTimeout(debounce.current);
    setValor("");
    aplicar("");
  };

  return (
    <div className={cn("relative min-w-0 flex-1 sm:min-w-56", className)}>
      <Search
        size={15}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-tenue"
      />
      <Input
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            clearTimeout(debounce.current);
            aplicar(valor);
          }
          if (e.key === "Escape" && valor) limpiar();
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        className="pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {valor && (
        <button
          type="button"
          onClick={limpiar}
          aria-label="Limpiar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-texto-tenue hover:text-texto"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** Select ligado a un parámetro de la URL. */
export function SelectUrl({
  param,
  ariaLabel,
  className,
  children,
}: {
  param: string;
  ariaLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const setParam = useSetParam();
  return (
    <Select
      value={searchParams.get(param) ?? ""}
      onChange={(e) => setParam({ [param]: e.target.value })}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </Select>
  );
}

/** Input de fecha ligado a un parámetro de la URL (yyyy-mm-dd). */
export function DateUrl({
  param,
  ariaLabel,
  className,
}: {
  param: string;
  ariaLabel: string;
  className?: string;
}) {
  const searchParams = useSearchParams();
  const setParam = useSetParam();
  return (
    <Input
      type="date"
      value={searchParams.get(param) ?? ""}
      onChange={(e) => setParam({ [param]: e.target.value })}
      aria-label={ariaLabel}
      className={className}
    />
  );
}

/** Checkbox ligado a un parámetro de la URL ("1" / vacío). */
export function CheckboxUrl({
  param,
  label,
}: {
  param: string;
  label: string;
}) {
  const searchParams = useSearchParams();
  const setParam = useSetParam();
  return (
    <label className="flex h-10 items-center gap-1.5 whitespace-nowrap text-sm text-texto-sec">
      <input
        type="checkbox"
        checked={searchParams.get(param) === "1"}
        onChange={(e) => setParam({ [param]: e.target.checked ? "1" : "" })}
      />
      {label}
    </label>
  );
}
