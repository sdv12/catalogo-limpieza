import { describe, it, expect } from "vitest";
import { buscarTemas, cumple, normalizar } from "@/lib/arau/buscar";
import { TEMAS, TEMA_POR_ID } from "@/lib/arau/temas";

const primero = (q: string) => buscarTemas(q)[0]?.tema.id;

describe("ARAU — búsqueda de temas", () => {
  it("normaliza tildes, mayúsculas y signos", () => {
    expect(normalizar("¿Cómo CARGO un Producto?")).toBe("como cargo un producto");
  });

  it.each([
    ["¿Cómo cargo un producto nuevo?", "producto-nuevo"],
    ["como ajusto el stock despues de un conteo", "stock-conteo"],
    ["llegó mercadería, cómo la sumo al stock", "stock-ajustar"],
    ["¿Cómo registro un pago de un cliente?", "cc-cargar"],
    ["el proveedor aumentó, cómo actualizo los costos", "proveedor-costos"],
    ["quiero subir precios un 10% a todos", "precio-lote"],
    ["me equivoqué con el aumento, cómo vuelvo atrás", "precio-error"],
    ["cómo importo productos desde excel", "carga-masiva"],
    ["quiero agregar un empleado nuevo", "usuarios-agregar"],
    ["¿quién modificó este precio?", "actividad"],
    ["imprimir etiquetas de góndola", "imprimir"],
    ["qué clientes están en mora", "cc-deudores"],
    ["poner un producto en oferta", "promos"],
    ["pantalla en blanco, no anda", "error-general"],
  ])("%s → %s", (q, id) => {
    expect(primero(q)).toBe(id);
  });

  it("no responde nada ante texto sin relación", () => {
    expect(buscarTemas("el clima de mañana en Japón")).toEqual([]);
  });

  it("los relacionados apuntan a temas existentes y los ids son únicos", () => {
    expect(TEMA_POR_ID.size).toBe(TEMAS.length);
    for (const t of TEMAS)
      for (const r of t.relacionados ?? []) expect(TEMA_POR_ID.has(r), `${t.id} → ${r}`).toBe(true);
  });

  it("chequea permisos por rol", () => {
    expect(cumple("editar", "viewer", [])).toBe(false);
    expect(cumple("editar", "empleado", [])).toBe(true);
    expect(cumple("precios_lote", "empleado", [])).toBe(false);
    expect(cumple("precios_lote", "empleado", ["precios_lote"])).toBe(true);
    expect(cumple("admin", "empleado", ["usuarios"])).toBe(false);
    expect(cumple("precios_lote", "admin", [])).toBe(true);
    expect(cumple("superadmin", "admin", [])).toBe(false);
  });
});
