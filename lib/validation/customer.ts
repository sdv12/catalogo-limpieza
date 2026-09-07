import { z } from "zod";
import { TIPOS_DOC, CONDICIONES_IVA } from "@/lib/constants";

export { parsearNumero } from "@/lib/validation/product";

const opt = z.preprocess(
  (v) => (v === "" || v == null ? null : String(v).trim()),
  z.string().nullable(),
);

export const customerSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio"),
  doc_type: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.enum(TIPOS_DOC).nullable(),
  ),
  doc_number: opt,
  tax_condition: z.enum(CONDICIONES_IVA).default("consumidor_final"),
  email: z.preprocess(
    (v) => (v === "" || v == null ? null : String(v).trim()),
    z.string().email("Email inválido").nullable(),
  ),
  phone: opt,
  address: opt,
  city: opt,
  province: opt,
  price_tier_id: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().uuid().nullable(),
  ),
  credit_limit: z.coerce.number().min(0).default(0),
  notes: opt,
  is_active: z.coerce.boolean().default(true),
});

export type CustomerInput = z.infer<typeof customerSchema>;
