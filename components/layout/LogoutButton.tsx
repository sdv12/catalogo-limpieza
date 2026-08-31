"use client";

import { LogOut } from "lucide-react";
import { cerrarSesion } from "@/app/panel/actions";

export function LogoutButton() {
  return (
    <form action={cerrarSesion}>
      <button
        type="submit"
        className="flex items-center gap-1.5 rounded-comp-sm px-2 py-1.5 text-sm text-texto-sec hover:bg-superficie-sec hover:text-texto"
      >
        <LogOut size={16} />
        <span className="hidden sm:inline">Salir</span>
      </button>
    </form>
  );
}
