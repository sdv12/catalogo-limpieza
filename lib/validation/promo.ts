import { z } from "zod";

const optStr = z.preprocess(
  (v) => (v === "" || v == null ? null : String(v).trim()),
  z.string().nullable(),
);

const optDate = z.preprocess(
  (v) => (v === "" || v == null ? null : new Date(String(v)).toISOString()),
  z.string().datetime().nullable(),
);

export const promoSchema = z
  .object({
    kind: z.enum(["slide", "destacado", "oferta"]),
    productId: z.string().uuid("Elegí un producto"),
    title: optStr,
    subtitle: optStr,
    link: optStr,
    discountType: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.enum(["percent", "amount"]).nullable(),
    ),
    discountValue: z.preprocess(
      (v) =>
        v === "" || v == null
          ? null
          : Number(String(v).replace(/\./g, "").replace(",", ".")),
      z.number().min(0).nullable(),
    ),
    startsAt: optDate,
    endsAt: optDate,
    isActive: z.coerce.boolean().default(true),
  })
  .refine(
    (d) =>
      d.kind !== "oferta" ||
      (d.discountType != null && d.discountValue != null && d.discountValue > 0),
    { message: "La oferta necesita un descuento (% o monto)", path: ["discountValue"] },
  )
  .refine(
    (d) => !d.startsAt || !d.endsAt || d.endsAt >= d.startsAt,
    { message: "La fecha de fin no puede ser anterior al inicio", path: ["endsAt"] },
  );

export type PromoInput = z.infer<typeof promoSchema>;

export const ETIQUETA_PROMO: Record<PromoInput["kind"], string> = {
  slide: "Carrusel",
  destacado: "Destacado",
  oferta: "Oferta",
};
