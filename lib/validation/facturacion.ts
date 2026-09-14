import { z } from "zod";

/**
 * Validación de los payloads que se mandan a TusFacturasAPP
 * (https://developers.tusfacturas.app). Los códigos de provincia/condición
 * de pago/moneda/alícuota van según las tablas de referencia de la API —
 * no se validan acá contra una lista cerrada porque no está confirmada,
 * solo se exige que no vengan vacíos.
 */

const fechaDDMMAAAA = z
  .string()
  .regex(/^\d{2}\/\d{2}\/\d{4}$/, "La fecha va en formato dd/mm/aaaa");

/** String numérico >= 0 (la API no acepta valores negativos en ningún campo). */
const numeroNoNegativo = (mensaje: string) =>
  z.string().refine((v) => {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) && n >= 0;
  }, mensaje);

export const clienteSchema = z.object({
  documento_tipo: z.enum(["CUIT", "DNI", "PASAPORTE", "OTRO"]),
  documento_nro: z.string().trim().min(1, "Falta el número de documento"),
  razon_social: z.string().trim().min(1, "Falta la razón social"),
  domicilio: z.string().trim().min(1, "Falta el domicilio"),
  provincia: z.string().trim().min(1, "Falta el código de provincia"),
  condicion_iva: z.string().trim().min(1, "Falta la condición de IVA"),
  condicion_pago: z.string().trim().min(1, "Falta la condición de pago"),
  email: z.string().email("Email inválido").optional(),
  envia_por_mail: z.enum(["S", "N"]),
  codigo: z.string().trim().min(1, "Falta el código interno del cliente"),
  rg5329: z.enum(["S", "N"]),
});

export const productoDetalleSchema = z.object({
  descripcion: z.string().trim().min(1, "Falta la descripción del producto"),
  unidad_bulto: z.string(),
  lista_precios: z.string(),
  codigo: z.string().trim().min(1, "Falta el código del producto"),
  // Sin IVA para FACTURA A/B (el IVA lo calcula la plataforma a partir de
  // `alicuota`); precio final para FACTURA C.
  precio_unitario_sin_iva: numeroNoNegativo("El precio no puede ser negativo"),
  alicuota: z.enum(["27", "21", "10.5", "5", "2.5", "0", "-1", "-2"]),
  unidad_medida: z.string(),
  actualiza_precio: z.enum(["S", "N"]),
  rg5329: z.enum(["S", "N"]),
});

export const detalleItemSchema = z.object({
  cantidad: numeroNoNegativo("La cantidad no puede ser negativa"),
  afecta_stock: z.enum(["S", "N"]),
  bonificacion_porcentaje: numeroNoNegativo("La bonificación no puede ser negativa").optional(),
  leyenda: z.string().optional(),
  producto: productoDetalleSchema,
});

export const tributoSchema = z.object({
  descripcion: z.string(),
  detalle: z.string().optional(),
  porcentaje: z.string().optional(),
  base_imponible: numeroNoNegativo("La base imponible no puede ser negativa").optional(),
  alicuota: z.string().optional(),
  importe: numeroNoNegativo("El importe del tributo no puede ser negativo"),
});

export const comprobanteAsociadoSchema = z.object({
  tipo: z.string().trim().min(1),
  punto_venta: z.string().trim().min(1),
  numero: z.string().trim().min(1),
});

const esNotaCreditoODebito = (tipo: string) => /^NOTA DE (CR[EÉ]DITO|D[EÉ]BITO)/i.test(tipo);

export const comprobanteSchema = z
  .object({
    fecha: fechaDDMMAAAA,
    tipo: z.string().trim().min(1, "Falta el tipo de comprobante"),
    operacion: z.enum(["V", "C"]),
    idioma: z.enum(["1", "2"]),
    punto_venta: z.string().trim().min(1, "Falta el punto de venta"),
    moneda: z.string().trim().min(1, "Falta la moneda"),
    cotizacion: numeroNoNegativo("La cotización no puede ser negativa"),
    numero: z.string().optional(),
    vencimiento: fechaDDMMAAAA,
    rubro: z.string().trim().min(1, "Falta el rubro"),
    rubro_grupo_contable: z.string().trim().min(1, "Falta el rubro contable"),
    detalle: z
      .array(detalleItemSchema)
      .min(1, "El comprobante necesita al menos un ítem")
      .max(130, "Máximo 130 ítems por comprobante"),
    tributos: z.array(tributoSchema).optional(),
    comprobantes_asociados: z.array(comprobanteAsociadoSchema).optional(),
    total: numeroNoNegativo("El total no puede ser negativo"),
  })
  .refine(
    (c) =>
      !esNotaCreditoODebito(c.tipo) ||
      (c.comprobantes_asociados && c.comprobantes_asociados.length > 0),
    {
      message:
        "Las notas de crédito/débito necesitan comprobantes_asociados (a qué factura corrigen)",
      path: ["comprobantes_asociados"],
    },
  );

export const emitirComprobanteInputSchema = z.object({
  cliente: clienteSchema,
  comprobante: comprobanteSchema,
  /** Para rastrear el comprobante en nuestro sistema (modo asincrónico / webhook). */
  external_reference: z.string().trim().min(1).optional(),
});

export type Cliente = z.infer<typeof clienteSchema>;
export type ProductoDetalle = z.infer<typeof productoDetalleSchema>;
export type DetalleItem = z.infer<typeof detalleItemSchema>;
export type Tributo = z.infer<typeof tributoSchema>;
export type ComprobanteAsociado = z.infer<typeof comprobanteAsociadoSchema>;
export type Comprobante = z.infer<typeof comprobanteSchema>;
export type EmitirComprobanteInput = z.infer<typeof emitirComprobanteInputSchema>;
