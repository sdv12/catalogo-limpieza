import { z } from "zod";
import { CONDICIONES_PAGO } from "@/lib/ventas";

export const itemVentaSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().positive("La cantidad tiene que ser mayor a 0").max(100000),
  /** null = precio de lista/especial calculado por la base */
  unitPrice: z.number().min(0).nullable(),
  reason: z.string().trim().max(200).nullable(),
  saveSpecial: z.boolean(),
});

export const ventaSchema = z
  .object({
    customerId: z.string().uuid().nullable(),
    payment: z.enum(CONDICIONES_PAGO),
    dueDate: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.string().date("Fecha inválida").nullable(),
    ),
    notes: z.string().trim().max(1000).nullable(),
    items: z.array(itemVentaSchema).min(1, "Agregá al menos un producto").max(200),
  })
  .refine((d) => d.payment !== "cuenta_corriente" || d.customerId, {
    message: "Una venta a cuenta corriente necesita un cliente",
    path: ["customerId"],
  });

export type VentaInput = z.infer<typeof ventaSchema>;
export type ItemVentaInput = z.infer<typeof itemVentaSchema>;
