/**
 * NOVEDADES del panel (sección «Novedades» del menú).
 *
 * Cada vez que se publica una versión, agregar una entrada ARRIBA con:
 * - la misma versión que `package.json` (el footer muestra esa versión),
 * - la fecha de publicación,
 * - los cambios contados en simple, para Matías y los empleados.
 */
export interface Novedad {
  version: string;
  /** "2026-11-18" */
  fecha: string;
  titulo: string;
  cambios: string[];
}

export const NOVEDADES: Novedad[] = [
  {
    version: "0.10.0",
    fecha: "2026-11-22",
    titulo: "Precios especiales por cliente y más control",
    cambios: [
      "En la ficha de cada cliente, nueva sección «Precios especiales»: le das a ese cliente un precio distinto en un producto, con motivo y vencimiento opcional. No cambia el precio general, ni el de otros clientes, ni la tienda online.",
      "Nuevo permiso «Precios especiales por cliente» para darle a un empleado. Un precio especial por debajo del costo solo lo puede dar un administrador.",
      "Si un precio queda por debajo del costo, se marca en rojo y pide confirmar antes de guardar. El casillero chico al lado del precio es el % de ganancia.",
      "Más control sobre los empleados: cambiar un precio ya cargado, cambiar el nivel de precio de un cliente y cargar ajustes o notas de crédito/débito en cuenta corriente ahora requieren su permiso. Cargos y pagos los sigue cargando cualquier empleado.",
      "Emitir comprobantes fiscales queda reservado a los administradores.",
      "Recordatorio: en «Precios» podés crear todos los niveles que necesites (Mayorista 1, 2, 3, Revendedor, Supermercado…).",
    ],
  },
  {
    version: "0.9.0",
    fecha: "2026-11-18",
    titulo: "Novedades y pie de página",
    cambios: [
      "Nueva sección «Novedades» en el menú: acá se cuenta qué cambió en el panel y cuándo. Cuando hay algo nuevo que todavía no viste, aparece un puntito rojo al lado.",
      "Abajo de cada pantalla ahora figura la versión del panel.",
    ],
  },
  {
    version: "0.8.0",
    fecha: "2026-11-16",
    titulo: "ARAU, el asistente del panel",
    cambios: [
      "Botón «Preguntale a ARAU» abajo a la derecha, en todas las pantallas del catálogo.",
      "Le escribís tu duda (por ejemplo «cómo cargo un producto» o «cómo registro un pago») y te explica el paso a paso.",
      "Con el botón de los cuadraditos ves todos los temas que sabe, ordenados por sección.",
      "Si tu usuario no tiene permiso para esa tarea, te avisa a quién pedírselo.",
    ],
  },
  {
    version: "0.7.0",
    fecha: "2026-09-15",
    titulo: "Permisos a medida para cada empleado",
    cambios: [
      "El administrador puede darle permisos puntuales a cada empleado desde «Usuarios»: precios en lote, costos y proveedores, carga masiva, promos, corregir cuenta corriente y gestionar usuarios.",
      "Los empleados ahora pueden cambiar el precio de un producto ya cargado (antes solo al crearlo).",
      "El menú muestra a cada uno solo las secciones que puede usar.",
    ],
  },
  {
    version: "0.6.0",
    fecha: "2026-09-14",
    titulo: "Facturación electrónica (preparada)",
    cambios: [
      "Nueva sección «Facturación» (solo administradores) que muestra si la conexión con AFIP/ARCA está activa y qué falta para activarla.",
      "Mientras no esté configurada, aparece un puntito naranja al lado de «Facturación» en el menú.",
      "Emitir facturas desde el panel llega con el futuro módulo de Ventas.",
    ],
  },
  {
    version: "0.5.0",
    fecha: "2026-09-11",
    titulo: "Cuenta corriente de clientes y equipo propio",
    cambios: [
      "En la ficha de cada cliente: saldo, próximo vencimiento y movimientos (cargos, pagos, notas de crédito y débito, ajustes).",
      "Cada cliente puede tener un vendedor asignado.",
      "En «Clientes» se puede filtrar por quién debe, quién está en mora y por fecha de vencimiento.",
      "En el inicio, tarjeta de «Cuentas por cobrar».",
      "Aviso automático por mail al cliente y a su vendedor 4 días antes de que venza una deuda (se activa cuando esté configurado el envío de mails).",
      "Nueva sección «Usuarios»: el administrador agrega a su equipo, le cambia el rol o lo quita del catálogo.",
    ],
  },
  {
    version: "0.4.0",
    fecha: "2026-09-10",
    titulo: "Buscador más simple y mejor en el celular",
    cambios: [
      "Un mismo buscador en Productos, Clientes y Proveedores: escribís y apretás Enter.",
      "El listado de productos se ve como tarjetas en el celular y los filtros se pliegan.",
      "Marca, proveedor y costo en el listado solo los ven los administradores.",
      "Rediseño de las etiquetas, la lista de pedido y el catálogo para imprimir.",
    ],
  },
  {
    version: "0.3.0",
    fecha: "2026-09-07",
    titulo: "Clientes, proveedores, promos e impresión",
    cambios: [
      "Roles por catálogo: Administrador, Empleado y Solo lectura (antes «Editor» y «Solo lectura»).",
      "Nuevas secciones «Clientes» y «Proveedores», con sus datos fiscales y de contacto.",
      "En la ficha del proveedor se ven sus productos con costo, precio y margen, y se puede actualizar el costo de todos de una vez.",
      "Aumento de precios en lote desde «Productos», sobre lo que esté filtrado (por categoría, marca, proveedor, etc.), incluido «fijar margen sobre el costo».",
      "Nueva sección «Promos»: carrusel, productos destacados y ofertas para la tienda online.",
      "Botón «Imprimir» en Productos: etiquetas de góndola, lista para pedido o conteo y catálogo para revendedores.",
      "Buscador rápido con Ctrl+K (o ⌘K en Mac) para saltar a cualquier sección, producto, cliente o proveedor.",
    ],
  },
  {
    version: "0.2.0",
    fecha: "2026-08-31",
    titulo: "Costos y márgenes",
    cambios: [
      "Cada presentación tiene su costo, y el precio se puede calcular poniendo el % de ganancia.",
      "El SKU de la presentación ya no es obligatorio: si lo dejás vacío se genera solo.",
      "Al dar de alta un usuario, el nombre es opcional.",
    ],
  },
  {
    version: "0.1.0",
    fecha: "2026-08-31",
    titulo: "Lanzamiento del panel",
    cambios: [
      "Carga de productos con presentaciones, precios por nivel, stock e imágenes.",
      "Categorías y subcategorías.",
      "Ajuste de stock con motivo (ingreso, venta, merma, conteo).",
      "Carga masiva desde Excel o CSV con planilla modelo.",
      "Historial de cambios por producto y sección «Actividad» con todo lo que se hizo y quién lo hizo.",
      "Los productos activos se publican solos en la tienda online.",
    ],
  },
];

export const VERSION_ACTUAL = NOVEDADES[0].version;
