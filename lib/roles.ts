/** Tipos y helpers de roles — seguros para cliente y servidor (sin `server-only`). */

export type RolCatalogo = "admin" | "empleado" | "viewer";
export type RolEfectivo = RolCatalogo | "superadmin";

export const ETIQUETA_ROL: Record<RolEfectivo, string> = {
  superadmin: "Administrador general",
  admin: "Administrador",
  empleado: "Empleado",
  viewer: "Solo lectura",
};

/**
 * Permisos opcionales que un admin puede prenderle a un empleado, además
 * de la base (productos/stock, clientes/proveedores, vender, cobrar con su caja, cargar cargos,
 * poner precio a un producto o presentación nueva).
 * admin los tiene todos siempre; viewer ninguno.
 */
export const PERMISOS_CATALOGO = [
  "precios_lote",
  "costos",
  "carga_masiva",
  "promos",
  "cuenta_corriente_admin",
  "usuarios",
  "precios_especiales",
  "caja_admin",
] as const;
export type PermisoCatalogo = (typeof PERMISOS_CATALOGO)[number];

export const ETIQUETA_PERMISO: Record<PermisoCatalogo, string> = {
  precios_lote: "Precios: modificar, niveles y reprecio en lote",
  costos: "Ver costos y proveedores, gestionar su costeo",
  carga_masiva: "Carga masiva de productos",
  promos: "Promos y ofertas",
  cuenta_corriente_admin: "Cuenta corriente: ajustes, notas y correcciones",
  usuarios: "Gestionar usuarios del catálogo",
  precios_especiales: "Precios especiales por cliente",
  caja_admin: "Caja: ver todas las cajas y anular recibos",
};

export const DESCRIPCION_PERMISO: Record<PermisoCatalogo, string> = {
  precios_lote:
    "Modificar el precio de un producto ya cargado, cambiar el nivel de precio de un cliente, crear/editar niveles y aplicar aumentos o descuentos en lote.",
  costos:
    "Ver marca, proveedor y costo en el listado de productos, y ajustar/propagar el costo de los proveedores.",
  carga_masiva: "Importar productos desde una planilla CSV/Excel.",
  promos: "Armar el carrusel, los destacados y las ofertas de la portada.",
  cuenta_corriente_admin:
    "Cargar pagos a mano (sin recibo), ajustes y notas de crédito/débito, y corregir o eliminar movimientos ya cargados. Los cobros normales se hacen desde la Caja con recibo.",
  usuarios:
    "Agregar, cambiar el rol/permisos o quitar a otros usuarios del catálogo (excepto administradores: eso sigue siendo solo de un admin).",
  precios_especiales:
    "Darle a un cliente puntual un precio distinto en un producto, sin cambiar el precio general ni la tienda.",
  caja_admin:
    "Ver y cerrar las cajas de todos, revisar diferencias de arqueo y anular recibos (cada empleado siempre maneja su propia caja).",
};

export type CatalogoAccesible = {
  id: string;
  slug: string;
  name: string;
  logo_path: string | null;
  is_active: boolean;
  /** Rol del usuario en este catálogo ("superadmin" si lo es globalmente). */
  rol: RolEfectivo;
  /** Permisos extra (solo aplican cuando rol === "empleado"). */
  permisos: PermisoCatalogo[];
};

/** Puede editar contenido (productos, stock, categorías, clientes, proveedores). */
export function puedeEditar(catalogo: CatalogoAccesible): boolean {
  return ["superadmin", "admin", "empleado"].includes(catalogo.rol);
}

/** Puede administrar el catálogo: precios, niveles, importación, configuración. */
export function esAdminCatalogo(catalogo: CatalogoAccesible): boolean {
  return catalogo.rol === "superadmin" || catalogo.rol === "admin";
}


/** Admin siempre true; empleado según sus permisos; viewer nunca. */
export function tienePermiso(
  catalogo: CatalogoAccesible,
  permiso: PermisoCatalogo,
): boolean {
  if (esAdminCatalogo(catalogo)) return true;
  return catalogo.rol === "empleado" && catalogo.permisos.includes(permiso);
}
