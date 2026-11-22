"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Tags,
  Upload,
  History,
  Users,
  Truck,
  Megaphone,
  UserCog,
  Receipt,
  Sparkles,
  ShoppingCart,
  ChevronLeft,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useNovedadesSinVer } from "@/components/novedades/visto";
import type { RolEfectivo, PermisoCatalogo } from "@/lib/roles";

type Item = {
  href: string;
  label: string;
  icon: typeof Package;
  exact?: boolean;
  /** punto de aviso al lado del label (ej: facturación sin configurar) */
  pendiente?: boolean;
  /** punto rojo: hay algo nuevo sin ver */
  nuevo?: boolean;
  /** contador (ej: pedidos nuevos sin confirmar) */
  contador?: number;
};

function items(
  slug: string,
  rol: RolEfectivo,
  permisos: PermisoCatalogo[],
  facturacionPendiente: boolean,
  novedadesSinVer: boolean,
  pedidosNuevos: number,
): Item[] {
  const b = `/panel/${slug}`;
  const esAdmin = rol === "superadmin" || rol === "admin";
  const tiene = (p: PermisoCatalogo) =>
    esAdmin || (rol === "empleado" && permisos.includes(p));

  const base: Item[] = [
    { href: b, label: "Inicio", icon: LayoutDashboard, exact: true },
    { href: `${b}/ventas`, label: "Ventas", icon: ShoppingCart, contador: pedidosNuevos },
    { href: `${b}/productos`, label: "Productos", icon: Package },
    { href: `${b}/categorias`, label: "Categorías", icon: FolderTree },
    { href: `${b}/clientes`, label: "Clientes", icon: Users },
    { href: `${b}/proveedores`, label: "Proveedores", icon: Truck },
  ];
  if (tiene("precios_lote")) {
    base.push({ href: `${b}/precios`, label: "Precios", icon: Tags });
  }
  if (tiene("promos")) {
    base.push({ href: `${b}/promos`, label: "Promos", icon: Megaphone });
  }
  if (esAdmin) {
    base.push({
      href: `${b}/facturacion`,
      label: "Facturación",
      icon: Receipt,
      pendiente: facturacionPendiente,
    });
  }
  if (tiene("carga_masiva")) {
    base.push({ href: `${b}/importar`, label: "Carga masiva", icon: Upload });
  }
  if (tiene("usuarios")) {
    base.push({ href: `${b}/usuarios`, label: "Usuarios", icon: UserCog });
  }
  base.push({ href: `${b}/actividad`, label: "Actividad", icon: History });
  base.push({
    href: `${b}/novedades`,
    label: "Novedades",
    icon: Sparkles,
    nuevo: novedadesSinVer,
  });
  return base;
}

export function CatalogSidebar({
  slug,
  nombre,
  rol,
  permisos,
  facturacionPendiente,
  pedidosNuevos,
  abierto,
  onCerrar,
}: {
  slug: string;
  nombre: string;
  rol: RolEfectivo;
  permisos: PermisoCatalogo[];
  facturacionPendiente: boolean;
  pedidosNuevos: number;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const pathname = usePathname();
  const novedadesSinVer = useNovedadesSinVer();
  const visibles = items(
    slug,
    rol,
    permisos,
    facturacionPendiente,
    novedadesSinVer,
    pedidosNuevos,
  );

  return (
    <>
      {abierto && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onCerrar}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-linea bg-superficie transition-transform lg:static lg:translate-x-0",
          abierto ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-linea px-4">
          <span className="truncate text-sm font-semibold text-texto">
            {nombre}
          </span>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-comp-sm p-1 text-texto-sec hover:bg-superficie-sec lg:hidden"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {visibles.map(({ href, label, icon: Icon, exact, pendiente, nuevo, contador }) => {
            const activo = exact
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={onCerrar}
                className={cn(
                  "flex items-center gap-3 rounded-comp-sm px-3 py-2 text-sm font-medium transition-colors",
                  activo
                    ? "bg-primario-suave text-primario-fuerte"
                    : "text-texto-sec hover:bg-superficie-sec hover:text-texto",
                )}
              >
                <Icon size={18} />
                {label}
                {pendiente && (
                  <span
                    className="ml-auto size-1.5 shrink-0 rounded-full bg-alerta"
                    title="Pendiente de configurar"
                    aria-label="Pendiente de configurar"
                  />
                )}
                {!!contador && (
                  <span
                    className="ml-auto rounded-full bg-error px-1.5 text-xs font-semibold tabular-nums text-white"
                    title={`${contador} pedido(s) nuevo(s) sin confirmar`}
                  >
                    {contador}
                  </span>
                )}
                {nuevo && (
                  <span
                    className="ml-auto size-2 shrink-0 rounded-full bg-error"
                    title="Hay novedades sin ver"
                    aria-label="Hay novedades sin ver"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-linea p-2">
          <Link
            href="/panel"
            onClick={onCerrar}
            className="flex items-center gap-2 rounded-comp-sm px-3 py-2 text-sm text-texto-sec hover:bg-superficie-sec hover:text-texto"
          >
            <ChevronLeft size={16} />
            Cambiar catálogo
          </Link>
        </div>
      </aside>
    </>
  );
}
