/** Constantes de dominio del catálogo. */

export const ESTADOS_PRODUCTO = ["active", "inactive"] as const;
export type EstadoProducto = (typeof ESTADOS_PRODUCTO)[number];

export const ETIQUETA_ESTADO: Record<EstadoProducto, string> = {
  active: "Activo",
  inactive: "Inactivo",
};

export const UNIDADES_MEDIDA = ["ml", "l", "g", "kg", "u"] as const;
export type UnidadMedida = (typeof UNIDADES_MEDIDA)[number];

export const ETIQUETA_UNIDAD: Record<UnidadMedida, string> = {
  ml: "Mililitros (ml)",
  l: "Litros (L)",
  g: "Gramos (g)",
  kg: "Kilos (kg)",
  u: "Unidad",
};

/** Motivos de ajuste de stock (quedan en la auditoría). */
export const MOTIVOS_STOCK = [
  "ingreso",
  "venta",
  "merma",
  "ajuste",
  "conteo",
  "importacion",
] as const;
export type MotivoStock = (typeof MOTIVOS_STOCK)[number];

export const ETIQUETA_MOTIVO_STOCK: Record<MotivoStock, string> = {
  ingreso: "Ingreso de mercadería",
  venta: "Venta",
  merma: "Merma / rotura",
  ajuste: "Ajuste manual",
  conteo: "Conteo de inventario",
  importacion: "Importación masiva",
};

/** Tipos de acción registrados en `audit_log`. */
export const ACCIONES_AUDITORIA = [
  "create",
  "update",
  "delete",
  "restore",
  "duplicate",
  "stock_adjust",
  "price_adjust",
  "bulk_import",
  "bulk_price_update",
] as const;
export type AccionAuditoria = (typeof ACCIONES_AUDITORIA)[number];

export const ETIQUETA_ACCION: Record<AccionAuditoria, string> = {
  create: "Creación",
  update: "Edición",
  delete: "Baja",
  restore: "Reactivación",
  duplicate: "Duplicado",
  stock_adjust: "Ajuste de stock",
  price_adjust: "Ajuste de precio",
  bulk_import: "Importación masiva",
  bulk_price_update: "Actualización de precios en lote",
};

export const ETIQUETA_ENTIDAD: Record<string, string> = {
  product: "Producto",
  variant: "Presentación",
  price: "Precio",
  stock: "Stock",
  category: "Categoría",
  image: "Imagen",
  catalog: "Catálogo",
  member: "Usuario",
  customer: "Cliente",
  supplier: "Proveedor",
};

export const TIPOS_DOC = ["DNI", "CUIT", "CUIL", "CDI", "Pasaporte", "Otro"] as const;
export type TipoDoc = (typeof TIPOS_DOC)[number];

export const CONDICIONES_IVA = [
  "responsable_inscripto",
  "monotributo",
  "consumidor_final",
  "exento",
  "no_categorizado",
] as const;
export type CondicionIVA = (typeof CONDICIONES_IVA)[number];

export const ETIQUETA_CONDICION_IVA: Record<CondicionIVA, string> = {
  responsable_inscripto: "Responsable inscripto",
  monotributo: "Monotributo",
  consumidor_final: "Consumidor final",
  exento: "Exento",
  no_categorizado: "No categorizado",
};

export const PROVINCIAS_AR = [
  "Buenos Aires",
  "CABA",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
] as const;

export const MONEDA_DEFAULT = "ARS";

/** Cantidad de cambios recientes que muestra el dashboard. */
export const CAMBIOS_RECIENTES_DASHBOARD = 10;

/** Tamaño de página del listado de productos. */
export const PRODUCTOS_POR_PAGINA = 25;

/** Bucket de Storage para imágenes de productos. */
export const BUCKET_IMAGENES = "product-images";
