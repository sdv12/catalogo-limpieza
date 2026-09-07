"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui/Field";

type Categoria = { id: string; name: string; parent_id: string | null };
type Proveedor = { id: string; name: string };

export function ProductsFilters({
  categorias,
  marcas,
  proveedores,
  valores,
}: {
  categorias: Categoria[];
  marcas: string[];
  proveedores: Proveedor[];
  valores: {
    q: string;
    categoria: string;
    marca: string;
    proveedor: string;
    estado: string;
    stock: string;
    borrados: boolean;
  };
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

  // búsqueda con debounce; Enter la dispara al instante
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

  const opcionesCategoria = (() => {
    const hijos = new Map<string | null, Categoria[]>();
    for (const c of categorias) {
      const lista = hijos.get(c.parent_id) ?? [];
      lista.push(c);
      hijos.set(c.parent_id, lista);
    }
    const out: { id: string; label: string }[] = [];
    const rec = (parent: string | null, pref: string) => {
      for (const c of hijos.get(parent) ?? []) {
        out.push({ id: c.id, label: pref + c.name });
        rec(c.id, pref + "— ");
      }
    };
    rec(null, "");
    return out;
  })();

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
          placeholder="Buscar por nombre, SKU, marca o proveedor…"
          className="pl-8"
          aria-label="Buscar productos"
        />
      </div>

      <Select
        value={valores.categoria}
        onChange={(e) => setParam({ categoria: e.target.value })}
        aria-label="Filtrar por categoría"
        className="w-44"
      >
        <option value="">Todas las categorías</option>
        {opcionesCategoria.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </Select>

      {marcas.length > 0 && (
        <Select
          value={valores.marca}
          onChange={(e) => setParam({ marca: e.target.value })}
          aria-label="Filtrar por marca"
          className="w-40"
        >
          <option value="">Todas las marcas</option>
          {marcas.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      )}

      {proveedores.length > 0 && (
        <Select
          value={valores.proveedor}
          onChange={(e) => setParam({ proveedor: e.target.value })}
          aria-label="Filtrar por proveedor"
          className="w-44"
        >
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      )}

      <Select
        value={valores.estado}
        onChange={(e) => setParam({ estado: e.target.value })}
        aria-label="Filtrar por estado"
        className="w-36"
      >
        <option value="">Todos los estados</option>
        <option value="active">Activos</option>
        <option value="inactive">Inactivos</option>
      </Select>

      <Select
        value={valores.stock}
        onChange={(e) => setParam({ stock: e.target.value })}
        aria-label="Filtrar por stock"
        className="w-36"
      >
        <option value="">Todo el stock</option>
        <option value="low">Stock bajo</option>
        <option value="ok">Stock ok</option>
      </Select>

      <label className="flex h-10 items-center gap-1.5 whitespace-nowrap text-sm text-texto-sec">
        <input
          type="checkbox"
          checked={valores.borrados}
          onChange={(e) => setParam({ borrados: e.target.checked ? "1" : "" })}
        />
        Ver dados de baja
      </label>
    </div>
  );
}
