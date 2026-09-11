import { z } from "zod";
import { TIPOS_MOVIMIENTO_CC, SIGNO_MOVIMIENTO_CC } from "@/lib/constants";
export { parsearNumero } from "@/lib/validation/product";

const optDate = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.string().date().nullable(),
);
const optStr = z.preprocess(
  (v) => (v === "" || v == null ? null : String(v).trim()),
  z.string().nullable(),
);

export const movimientoSchema = z
  .object({
    kind: z.enum(TIPOS_MOVIMIENTO_CC),
    amount: z.number().refine((v) => v !== 0, "El importe no puede ser cero"),
    due_date: optDate,
    note: optStr,
  })
  .refine(
    (d) => {
      const signo = SIGNO_MOVIMIENTO_CC[d.kind];
      return signo == null || Math.sign(d.amount) === signo;
    },
    { message: "El signo del importe no corresponde con el tipo de movimiento", path: ["amount"] },
  );

export type MovimientoInput = z.infer<typeof movimientoSchema>;
