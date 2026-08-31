import { describe, it, expect } from "vitest";
import {
  parsearNumero,
  preciosValidos,
  validarPreciosMinimos,
  productoSchema,
} from "@/lib/validation/product";

describe("parsearNumero", () => {
  it("acepta punto decimal", () => {
    expect(parsearNumero("1234.5")).toBe(1234.5);
  });
  it("acepta formato argentino con miles y coma", () => {
    expect(parsearNumero("1.234,50")).toBe(1234.5);
  });
  it("devuelve null para vacío o inválido", () => {
    expect(parsearNumero("")).toBeNull();
    expect(parsearNumero("abc")).toBeNull();
  });
});

describe("preciosValidos", () => {
  it("filtra precios vacíos y no positivos", () => {
    const r = preciosValidos({
      "11111111-1111-1111-1111-111111111111": "1500",
      "22222222-2222-2222-2222-222222222222": "",
      "33333333-3333-3333-3333-333333333333": "0",
    });
    expect(r).toEqual([
      { tierId: "11111111-1111-1111-1111-111111111111", price: 1500 },
    ]);
  });
});

describe("validarPreciosMinimos", () => {
  const base = {
    name: "Test",
    description: null,
    brand: null,
    base_sku: null,
    primary_category_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    extra_category_ids: [],
    status: "active" as const,
    images: [],
  };
  const variante = {
    name: "500ml",
    sku: "X-500",
    size_value: null,
    size_unit: null,
    barcode: null,
    min_stock: 0,
    stock_inicial: 0,
  };

  it("rechaza una variante sin precios", () => {
    const err = validarPreciosMinimos({
      ...base,
      variants: [{ ...variante, prices: {} }],
    });
    expect(err).toMatch(/necesita al menos un precio/);
  });

  it("acepta cuando hay al menos un precio", () => {
    const err = validarPreciosMinimos({
      ...base,
      variants: [
        { ...variante, prices: { "11111111-1111-1111-1111-111111111111": "990" } },
      ],
    });
    expect(err).toBeNull();
  });
});

describe("productoSchema", () => {
  it("exige nombre y categoría", () => {
    const r = productoSchema.safeParse({ name: "", variants: [] });
    expect(r.success).toBe(false);
  });
});
