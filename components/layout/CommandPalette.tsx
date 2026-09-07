"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  Package,
  FolderTree,
  Tags,
  Upload,
  History,
  Users,
  Truck,
  Plus,
  CornerDownLeft,
} from "lucide-react";
import {
  buscarGlobal,
  type ResultadosBusqueda,
} from "@/app/panel/[catalogo]/buscar-actions";
import type { RolEfectivo } from "@/lib/roles";

type Accion = { label: string; hint: string; href: string; icon: typeof Package };

function navegacion(slug: string, rol: RolEfectivo): Accion[] {
  const b = `/panel/${slug}`;
  const admin = rol === "superadmin" || rol === "admin";
  const puedeEditar = admin || rol === "empleado";
  return [
    { label: "Inicio", hint: "Dashboard", href: b, icon: LayoutDashboard },
    { label: "Productos", hint: "Listado", href: `${b}/productos`, icon: Package },
    ...(puedeEditar
      ? [
          {
            label: "Nuevo producto",
            hint: "Crear",
            href: `${b}/productos/nuevo`,
            icon: Plus,
          },
        ]
      : []),
    { label: "Categorías", hint: "Árbol", href: `${b}/categorias`, icon: FolderTree },
    { label: "Clientes", hint: "Listado", href: `${b}/clientes`, icon: Users },
    ...(puedeEditar
      ? [
          {
            label: "Nuevo cliente",
            hint: "Crear",
            href: `${b}/clientes/nuevo`,
            icon: Plus,
          },
        ]
      : []),
    { label: "Proveedores", hint: "Listado", href: `${b}/proveedores`, icon: Truck },
    ...(admin
      ? [
          { label: "Precios", hint: "Niveles y lote", href: `${b}/precios`, icon: Tags },
          {
            label: "Carga masiva",
            hint: "Importar",
            href: `${b}/importar`,
            icon: Upload,
          },
        ]
      : []),
    { label: "Actividad", hint: "Auditoría", href: `${b}/actividad`, icon: History },
  ];
}

export function CommandPalette({ slug, rol }: { slug: string; rol: RolEfectivo }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [res, setRes] = useState<ResultadosBusqueda | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const abrir = () => {
    setQ("");
    setRes(null);
    setSel(0);
    setAbierto(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierto((v) => {
          if (!v) {
            setQ("");
            setRes(null);
            setSel(0);
          }
          return !v;
        });
      }
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!abierto) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const t = setTimeout(() => {
      if (q.trim().length >= 2) {
        startTransition(async () => setRes(await buscarGlobal(slug, q)));
      } else {
        setRes(null);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, abierto, slug]);

  const nav = navegacion(slug, rol);
  const term = q.trim().toLowerCase();
  const navFiltrado = term
    ? nav.filter((n) => n.label.toLowerCase().includes(term))
    : nav;

  const items: { label: string; sub: string; href: string; icon: typeof Package }[] =
    [
      ...navFiltrado.map((n) => ({
        label: n.label,
        sub: n.hint,
        href: n.href,
        icon: n.icon,
      })),
      ...(res?.productos ?? []).map((p) => ({
        label: p.name,
        sub: p.base_sku ? `Producto · ${p.base_sku}` : "Producto",
        href: `/panel/${slug}/productos/${p.id}`,
        icon: Package,
      })),
      ...(res?.clientes ?? []).map((c) => ({
        label: c.name,
        sub: "Cliente",
        href: `/panel/${slug}/clientes/${c.id}`,
        icon: Users,
      })),
      ...(res?.proveedores ?? []).map((s) => ({
        label: s.name,
        sub: "Proveedor",
        href: `/panel/${slug}/proveedores/${s.id}`,
        icon: Truck,
      })),
    ];

  const ir = (href: string) => {
    setAbierto(false);
    router.push(href);
  };

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={abrir}
        className="hidden items-center gap-2 rounded-comp-sm border border-linea px-2.5 py-1.5 text-xs text-texto-tenue hover:bg-superficie-sec sm:flex"
      >
        <Search size={13} />
        Buscar
        <kbd className="rounded border border-linea bg-superficie-sec px-1 text-[10px]">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onClick={() => setAbierto(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-comp bg-superficie shadow-[var(--sombra-pop)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSel((s) => Math.min(s + 1, items.length - 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setSel((s) => Math.max(s - 1, 0));
          }
          if (e.key === "Enter" && items[sel]) {
            e.preventDefault();
            ir(items[sel].href);
          }
        }}
      >
        <div className="flex items-center gap-2 border-b border-linea px-3">
          <Search size={16} className="text-texto-tenue" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            placeholder="Buscar secciones, productos, clientes, proveedores…"
            className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-texto-tenue"
          />
        </div>

        <div className="max-h-80 overflow-y-auto p-1">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-texto-tenue">
              {q.trim().length >= 2 ? "Sin resultados" : "Escribí para buscar"}
            </p>
          ) : (
            items.map((it, i) => (
              <button
                key={`${it.href}-${i}`}
                onClick={() => ir(it.href)}
                onMouseEnter={() => setSel(i)}
                className={`flex w-full items-center gap-3 rounded-comp-sm px-3 py-2 text-left text-sm ${
                  i === sel ? "bg-primario-suave text-primario-fuerte" : "text-texto"
                }`}
              >
                <it.icon size={16} className="shrink-0 text-texto-tenue" />
                <span className="min-w-0 flex-1 truncate">{it.label}</span>
                <span className="shrink-0 text-xs text-texto-tenue">{it.sub}</span>
                {i === sel && (
                  <CornerDownLeft size={12} className="shrink-0 text-texto-tenue" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
