import "server-only";
import {
  resolverCatalogo,
  puedeEditar,
  esAdminCatalogo,
  type CatalogoAccesible,
} from "@/lib/dal";

/**
 * Resuelve el catálogo por slug (404 si no hay acceso) y exige permiso de
 * edición (admin o empleado). Usar al principio de cada Server Action que
 * modifica el catálogo.
 */
export async function exigirEdicion(slug: string): Promise<CatalogoAccesible> {
  const catalogo = await resolverCatalogo(slug);
  if (!puedeEditar(catalogo)) {
    throw new Error("No tenés permiso de edición en este catálogo");
  }
  return catalogo;
}

/**
 * Igual que exigirEdicion pero exige rol de administrador del catálogo
 * (precios, niveles de precio, importación masiva, configuración).
 */
export async function exigirAdmin(slug: string): Promise<CatalogoAccesible> {
  const catalogo = await resolverCatalogo(slug);
  if (!esAdminCatalogo(catalogo)) {
    throw new Error("Esta acción es solo para administradores del catálogo");
  }
  return catalogo;
}

export type ResultadoAccion = {
  ok: boolean;
  message: string;
  data?: unknown;
};
