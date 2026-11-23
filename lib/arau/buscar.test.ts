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
    ["¿Cómo registro un pago de un cliente?", "caja-cobrar"],
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
    ["qué hay de nuevo en el panel", "novedades"],
    ["quiero darle un precio especial a un cliente", "precio-especial"],
    ["cómo cargo una venta", "venta-nueva"],
    ["cómo abro la caja", "caja-abrir"],
    ["cómo entro a otra sucursal", "cambiar-catalogo"],
    ["quiero crear una sucursal nueva", "catalogos"],
    ["cómo hago el cierre de caja", "caja-cerrar"],
    ["me pagó por transferencia", "caja-cobrar"],
    ["tengo que sacar plata para un gasto", "caja-egreso"],
    ["cobré mal, quiero anular el recibo", "recibo-anular"],
    ["el cliente paga contra entrega", "caja-venta-contado"],
    ["no me deja confirmar porque no hay stock", "venta-stock"],
    ["cómo cancelo un pedido", "venta-cancelar"],
    ["le quiero hacer un descuento solo en esta venta", "venta-precio"],
    ["llegan los pedidos de la tienda online", "venta-canales"],
    ["cómo paso un pedido a entregado", "venta-estados"],
    ["precio distinto solo para un cliente", "precio-especial"],
    ["cómo cambio el precio de un producto", "precio-uno"],
    ["necesito más niveles de precio, mayorista 2", "precio-niveles"],
    ["qué es el puntito rojo en novedades", "novedades"],
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
