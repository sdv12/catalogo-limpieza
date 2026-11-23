import { LogoutButton } from "@/components/layout/LogoutButton";

/** Barra superior de las pantallas fuera de un catálogo (inicio, sucursales, administración). */
export function PanelTopbar({ usuario }: { usuario: string }) {
  return (
    <header className="flex h-14 items-center border-b border-linea bg-superficie px-4 sm:px-6">
      <span className="text-sm font-semibold text-texto">Panel de catálogo</span>
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden text-sm text-texto-sec sm:inline">{usuario}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
