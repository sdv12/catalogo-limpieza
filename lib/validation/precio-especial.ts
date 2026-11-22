import { z } from "zod";

export const precioEspecialSchema = z.object({
  variantId: z.string().uuid("Elegí un producto"),
  price: z
    .number({ message: "Ingresá el precio" })
    .min(0, "El precio no puede ser negativo")
    .max(999_999_999, "Precio demasiado alto"),
  reason: z
    .string()
    .trim()
    .min(3, "Escribí el motivo (ej: \"acuerdo por volumen\")")
    .max(200, "El motivo es muy largo (máx. 200 caracteres)"),
  endsOn: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().date("Fecha inválida").nullable(),
  ),
});

export type PrecioEspecialInput = z.infer<typeof precioEspecialSchema>;

/** Un precio especial vale hasta su fecha de vencimiento inclusive. */
export function precioEspecialVigente(endsOn: string | null, hoy: string): boolean {
  return endsOn == null || endsOn >= hoy;
}
