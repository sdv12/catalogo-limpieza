import "server-only";
import {
  resolverCatalogo,
  puedeEditar,
  esAdminCatalogo,
  tienePermiso,
  ETIQUETA_PERMISO,
  type CatalogoAccesible,
  type PermisoCatalogo,
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

/**
 * Exige un permiso puntual del catálogo (admin lo tiene siempre; un
 * empleado solo si se lo prendieron). Usar en las acciones que antes
 * exigían admin pero ahora pueden delegarse: precios en lote, costos,
 * carga masiva, promos, cuenta corriente, usuarios.
 */
export async function exigirPermiso(
  slug: string,
  permiso: PermisoCatalogo,
): Promise<CatalogoAccesible> {
  const catalogo = await resolverCatalogo(slug);
  if (!tienePermiso(catalogo, permiso)) {
    throw new Error(`No tenés el permiso "${ETIQUETA_PERMISO[permiso]}" en este catálogo`);
  }
  return catalogo;
}

export type ResultadoAccion = {
  ok: boolean;
  message: string;
  data?: unknown;
};
