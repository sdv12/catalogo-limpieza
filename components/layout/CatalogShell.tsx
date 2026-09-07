"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { CatalogSidebar } from "@/components/layout/CatalogSidebar";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { Badge } from "@/components/ui/Badge";
import { ETIQUETA_ROL, type RolEfectivo } from "@/lib/roles";

export function CatalogShell({
  children,
  slug,
  nombreCatalogo,
  usuario,
  rol,
}: {
  children: React.ReactNode;
  slug: string;
  nombreCatalogo: string;
  usuario: string;
  rol: RolEfectivo;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <div className="flex min-h-screen flex-1">
      <CatalogSidebar
        slug={slug}
        nombre={nombreCatalogo}
        rol={rol}
        abierto={menuAbierto}
        onCerrar={() => setMenuAbierto(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-linea bg-superficie px-4">
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            className="rounded-comp-sm p-1.5 text-texto-sec hover:bg-superficie-sec lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>

          {rol === "viewer" && <Badge tono="alerta">Solo lectura</Badge>}
          {rol === "empleado" && <Badge tono="info">Empleado</Badge>}

          <div className="ml-auto flex items-center gap-3">
            <CommandPalette slug={slug} rol={rol} />
            <span className="hidden text-right text-sm text-texto-sec sm:block">
              {usuario}
              <span className="block text-xs text-texto-tenue">
                {ETIQUETA_ROL[rol]}
              </span>
            </span>
            <LogoutButton />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
