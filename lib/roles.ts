/** Tipos y helpers de roles — seguros para cliente y servidor (sin `server-only`). */

export type RolCatalogo = "admin" | "empleado" | "viewer";
export type RolEfectivo = RolCatalogo | "superadmin";

export const ETIQUETA_ROL: Record<RolEfectivo, string> = {
  superadmin: "Administrador general",
  admin: "Administrador",
  empleado: "Empleado",
  viewer: "Solo lectura",
};

export type CatalogoAccesible = {
  id: string;
  slug: string;
  name: string;
  logo_path: string | null;
  is_active: boolean;
  /** Rol del usuario en este catálogo ("superadmin" si lo es globalmente). */
  rol: RolEfectivo;
};

/** Puede editar contenido (productos, stock, categorías, clientes, proveedores). */
export function puedeEditar(catalogo: CatalogoAccesible): boolean {
  return ["superadmin", "admin", "empleado"].includes(catalogo.rol);
}

/** Puede administrar el catálogo: precios, niveles, importación, configuración. */
export function esAdminCatalogo(catalogo: CatalogoAccesible): boolean {
  return catalogo.rol === "superadmin" || catalogo.rol === "admin";
}

/** Puede modificar precios (alias de esAdminCatalogo). */
export const puedeEditarPrecios = esAdminCatalogo;
