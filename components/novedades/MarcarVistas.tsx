"use client";

import { useEffect } from "react";
import { marcarNovedadesVistas } from "@/components/novedades/visto";

/** Al abrir la pantalla de Novedades, se apaga el puntito del menú. */
export function MarcarVistas() {
  useEffect(() => {
    marcarNovedadesVistas();
  }, []);
  return null;
}
