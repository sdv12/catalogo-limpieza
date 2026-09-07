import { z } from "zod";

const opt = z.preprocess(
  (v) => (v === "" || v == null ? null : String(v).trim()),
  z.string().nullable(),
);

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio"),
  doc_type: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.enum(["CUIT", "CUIL", "DNI", "Otro"]).nullable(),
  ),
  doc_number: opt,
  contact_name: opt,
  email: z.preprocess(
    (v) => (v === "" || v == null ? null : String(v).trim()),
    z.string().email("Email inválido").nullable(),
  ),
  phone: opt,
  address: opt,
  city: opt,
  province: opt,
  payment_terms: opt,
  notes: opt,
  is_active: z.coerce.boolean().default(true),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
