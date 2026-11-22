"use client";

import { useSyncExternalStore } from "react";
import { VERSION_ACTUAL } from "@/content/novedades";

/** Recuerda (por navegador) hasta qué versión de Novedades vio el usuario. */
const CLAVE = "catalogo:novedades-vistas";
const oyentes = new Set<() => void>();

function leer() {
  try {
    return window.localStorage.getItem(CLAVE) ?? "";
  } catch {
    return VERSION_ACTUAL;
  }
}

export function marcarNovedadesVistas() {
  try {
    window.localStorage.setItem(CLAVE, VERSION_ACTUAL);
  } catch {
    /* sin almacenamiento no se recuerda */
  }
  oyentes.forEach((f) => f());
}

/** Hay novedades que el usuario todavía no abrió (puntito rojo del menú). */
export function useNovedadesSinVer(): boolean {
  const vista = useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    leer,
    () => VERSION_ACTUAL,
  );
  return vista !== VERSION_ACTUAL;
}
