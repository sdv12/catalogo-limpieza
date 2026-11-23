/** Constantes de Ventas — seguras para cliente y servidor. */

export const ESTADOS_PEDIDO = [
  "nuevo",
  "confirmado",
  "preparando",
  "en_reparto",
  "entregado",
  "cancelado",
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export const ETIQUETA_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  nuevo: "Nuevo",
  confirmado: "Confirmado",
  preparando: "Preparando",
  en_reparto: "En reparto",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const TONO_ESTADO_PEDIDO: Record<
  EstadoPedido,
  "neutro" | "exito" | "alerta" | "error" | "info" | "primario"
> = {
  nuevo: "alerta",
  confirmado: "info",
  preparando: "primario",
  en_reparto: "primario",
  entregado: "exito",
  cancelado: "neutro",
};

/** Estados a los que se puede avanzar desde cada estado (solo hacia adelante). */
export const SIGUIENTES_ESTADOS: Partial<Record<EstadoPedido, EstadoPedido[]>> = {
  confirmado: ["preparando", "en_reparto", "entregado"],
  preparando: ["en_reparto", "entregado"],
  en_reparto: ["entregado"],
};

export const CANALES_PEDIDO = ["panel", "tienda", "whatsapp", "otro"] as const;
export type CanalPedido = (typeof CANALES_PEDIDO)[number];

export const ETIQUETA_CANAL: Record<CanalPedido, string> = {
  panel: "Panel",
  tienda: "Tienda online",
  whatsapp: "WhatsApp",
  otro: "Otro",
};

/** Canales externos que pueden tener clave de API. */
export const CANALES_EXTERNOS = ["tienda", "whatsapp", "otro"] as const;
export type CanalExterno = (typeof CANALES_EXTERNOS)[number];

export const CONDICIONES_PAGO = ["contado", "cuenta_corriente"] as const;
export type CondicionPago = (typeof CONDICIONES_PAGO)[number];

export const ETIQUETA_CONDICION_PAGO: Record<CondicionPago, string> = {
  contado: "Contado",
  cuenta_corriente: "Cuenta corriente",
};

export const ETIQUETA_ORIGEN_PRECIO: Record<string, string> = {
  lista: "Lista",
  especial: "Especial del cliente",
  manual: "Cambiado en la venta",
};

export const METODOS_PAGO = [
  "efectivo",
  "transferencia",
  "mercado_pago",
  "debito",
  "credito",
] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export const ETIQUETA_METODO_PAGO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercado_pago: "Mercado Pago",
  debito: "Tarjeta de débito",
  credito: "Tarjeta de crédito",
};

/** Línea de pago de un recibo (lo que manda la UI). */
export type LineaPago = { method: MetodoPago; amount: number; reference: string | null };
