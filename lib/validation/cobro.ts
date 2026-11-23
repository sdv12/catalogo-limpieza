import { z } from "zod";
import { METODOS_PAGO } from "@/lib/ventas";

export const lineasPagoSchema = z
  .array(
    z.object({
      method: z.enum(METODOS_PAGO),
      amount: z.number().positive("Cada medio de pago tiene que tener un importe").max(999_999_999),
      reference: z.string().trim().max(100).nullable(),
    }),
  )
  .min(1, "Indicá al menos un medio de pago")
  .max(10);
