import { describe, it, expect } from "vitest";
import { generarSlug, formatearMoneda } from "@/lib/format";

describe("generarSlug", () => {
  it("normaliza acentos y espacios", () => {
    expect(generarSlug("Limpieza de Baño")).toBe("limpieza-de-bano");
  });

  it("quita símbolos y guiones sobrantes", () => {
    expect(generarSlug("  Desinfectantes / Amoníaco  ")).toBe(
      "desinfectantes-amoniaco",
    );
  });
});

describe("formatearMoneda", () => {
  it("devuelve guion para valores nulos", () => {
    expect(formatearMoneda(null)).toBe("—");
  });

  it("formatea en pesos", () => {
    expect(formatearMoneda(1500)).toContain("1.500");
  });
});
