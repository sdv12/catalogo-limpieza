/**
 * Base de conocimiento de ARAU (hardcodeada, sin IA).
 *
 * Cada tema tiene:
 *  - titulo:   cómo se muestra en el menú y en las sugerencias.
 *  - claves:   palabras o frases que lo disparan (sin importar tildes ni mayúsculas).
 *              Las frases de varias palabras suman más que las sueltas.
 *  - respuesta: texto que muestra ARAU (texto plano, una línea por paso).
 *  - requiere: quién puede hacerlo. Si el usuario no cumple, ARAU se lo avisa
 *              antes de la respuesta.
 *
 * Cuando cambie una pantalla del panel, actualizar acá el tema que la explica.
 */
import type { PermisoCatalogo } from "@/lib/roles";

export type Requisito = "editar" | "admin" | "superadmin" | PermisoCatalogo;

export type Tema = {
  id: string;
  categoria: Categoria;
  titulo: string;
  claves: string[];
  respuesta: string;
  requiere?: Requisito;
  relacionados?: string[];
};

export const CATEGORIAS = [
  "General",
  "Ventas",
  "Caja",
  "Productos",
  "Stock",
  "Precios",
  "Clientes",
  "Proveedores",
  "Promos",
  "Carga masiva",
  "Usuarios",
  "Facturación",
  "Actividad",
  "Problemas",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const TEMAS: Tema[] = [
  // ───────────────────────── General
  {
    id: "ingresar",
    categoria: "General",
    titulo: "No puedo entrar al panel",
    claves: ["entrar", "ingresar", "login", "contraseña", "clave", "sin acceso", "no puedo entrar", "olvide", "iniciar sesion", "password"],
    respuesta: `Se entra con email y contraseña. No hay registro público: los usuarios los da de alta un administrador.
Si no podés entrar:
1. Revisá que el email esté bien escrito y probá de nuevo la contraseña.
2. Si aparece "sin acceso", tu usuario puede estar inactivo o no asignado a ningún catálogo.
3. Pedile a un administrador que lo revise en "Usuarios" (o al administrador general).
4. Si olvidaste la contraseña y nadie la puede resetear, avisale al desarrollador.`,
    relacionados: ["usuarios-agregar", "roles"],
  },
  {
    id: "novedades",
    categoria: "General",
    titulo: "Qué cambió en el panel (Novedades)",
    claves: ["novedades", "que cambio", "cambios", "actualizacion", "actualizaciones", "nuevo", "version", "punto rojo", "puntito rojo", "que hay de nuevo"],
    respuesta: `En el menú lateral está "Novedades": ahí se cuenta cada actualización del panel, con la fecha y qué cambió.
1. Tocá "Novedades" en el menú (abajo de "Actividad").
2. Arriba de todo está lo último que se agregó.
Cuando hay algo nuevo que todavía no viste, aparece un puntito rojo al lado de "Novedades". Se apaga cuando la abrís.
La versión actual del panel figura también abajo de cada pantalla.`,
    relacionados: ["dashboard", "actividad"],
  },
  {
    id: "cambiar-catalogo",
    categoria: "General",
    titulo: "Cambiar de catálogo (Aura / Aromas)",
    claves: ["cambiar catalogo", "otro catalogo", "aura", "aromas", "selector", "elegir catalogo"],
    respuesta: `Cada catálogo tiene sus propios productos, precios, clientes, proveedores y usuarios.
1. En el menú lateral, abajo de todo, tocá "Cambiar catálogo".
2. En el selector elegí el catálogo al que querés ir.
Solo ves los catálogos a los que te dieron acceso.`,
  },
  {
    id: "buscador",
    categoria: "General",
    titulo: "Buscar rápido cualquier cosa",
    claves: ["buscar", "buscador", "busqueda", "encontrar", "ctrl k", "atajo", "paleta"],
    respuesta: `Arriba a la derecha está el buscador global.
- Se abre también con Ctrl + K (Cmd + K en Mac).
- Sirve para saltar a una sección (Productos, Clientes…) o encontrar un producto, cliente o proveedor por nombre.
- Movete con las flechas y entrá con Enter.`,
  },
  {
    id: "roles",
    categoria: "General",
    titulo: "Roles y permisos: qué puede hacer cada uno",
    claves: ["rol", "roles", "permiso", "permisos", "empleado", "administrador", "solo lectura", "viewer", "no me aparece", "no veo", "falta seccion", "no tengo permiso"],
    respuesta: `- Administrador: puede todo en el catálogo (precios, carga masiva, promos, costos, cuenta corriente, facturación y usuarios).
- Empleado: puede productos y stock, categorías, clientes y proveedores, cargar cargos y pagos en cuenta corriente y ponerle precio a un producto nuevo. Un admin le puede prender permisos extra: precios (cambiar precios ya cargados, niveles y en lote), precios especiales por cliente, costos, carga masiva, promos, cuenta corriente (ajustes y notas) y gestionar usuarios.
- Solo lectura: ve todo pero no puede cambiar nada (arriba dice "Solo lectura").
Si te falta una sección del menú o te sale "No tenés permiso…", pedile a un administrador que te prenda el permiso en "Usuarios".`,
    relacionados: ["usuarios-permisos"],
  },
  {
    id: "menu-celular",
    categoria: "General",
    titulo: "Usar el panel desde el celular",
    claves: ["celular", "telefono movil", "menu", "movil", "no veo el menu"],
    respuesta: `En el celular el menú lateral está escondido.
1. Tocá el botón de las tres rayitas arriba a la izquierda.
2. Elegí la sección.
El menú se cierra solo al elegir o tocando afuera.`,
  },
  {
    id: "dashboard",
    categoria: "General",
    titulo: "Qué muestra la pantalla de Inicio",
    claves: ["inicio", "dashboard", "resumen", "tarjetas", "ultimos cambios", "pantalla principal"],
    respuesta: `En "Inicio" tenés:
- Tarjetas con totales: Productos, Stock bajo, Inactivos, Categorías, Clientes y Proveedores. Tocando una vas al listado ya filtrado (ej: "Stock bajo").
- Accesos rápidos: "Nuevo producto", "Nuevo cliente", "Carga masiva", "Precios en lote" (según tus permisos).
- "Últimos cambios": lo último que se modificó en el catálogo.`,
  },
  {
    id: "tienda",
    categoria: "General",
    titulo: "El cambio no se ve en la tienda online",
    claves: ["tienda", "landing", "pagina web", "web", "no aparece en la tienda", "no se ve", "online", "sitio"],
    respuesta: `La tienda toma productos, precios, stock e imágenes del panel automáticamente.
1. Esperá unos 2 minutos: la tienda guarda una copia temporal.
2. Recargá la tienda.
3. Si sigue sin verse, revisá que el producto esté "Activo", tenga categoría y precio cargado.
4. Si todo está bien y no aparece, avisale al desarrollador.`,
    relacionados: ["producto-baja"],
  },

  // ───────────────────────── Productos
  {
    id: "producto-nuevo",
    categoria: "Productos",
    titulo: "Cargar un producto nuevo",
    claves: ["producto nuevo", "nuevo producto", "cargar producto", "crear producto", "agregar producto", "alta producto", "dar de alta"],
    requiere: "editar",
    respuesta: `1. Andá a "Productos" → "Nuevo producto".
2. En "Datos del producto" completá Nombre y Categoría principal (obligatorios). Opcional: Marca, Código interno / SKU base (si lo dejás vacío se genera solo), Descripción, Categorías adicionales y Estado.
3. En "Presentaciones y precios" cargá cada presentación (ej: "Bidón 5 L"): SKU, Tamaño y Unidad, Código de barras, Stock inicial, Stock mínimo, Costo y el precio de cada nivel.
4. En "Imágenes" subí las fotos.
5. Tocá "Crear producto".
Tip: si vas a cargar uno parecido a otro, usá "Duplicar" en el listado.`,
    relacionados: ["presentaciones", "producto-duplicar", "carga-masiva"],
  },
  {
    id: "presentaciones",
    categoria: "Productos",
    titulo: "Presentaciones (tamaños) de un producto",
    claves: ["presentacion", "presentaciones", "variante", "tamaño", "bidon", "litros", "sku", "codigo de barras", "unidad"],
    requiere: "editar",
    respuesta: `Un producto puede tener varias presentaciones (ej: "Botella 750 ml" y "Bidón 5 L"). Cada una tiene su propio SKU, stock, costo y precios.
1. Entrá al producto desde "Productos".
2. En "Presentaciones y precios" agregá una nueva o tocá "Quitar presentación" para sacar una.
3. "Guardar cambios".
El SKU tiene que ser único en todo el catálogo.`,
  },
  {
    id: "producto-editar",
    categoria: "Productos",
    titulo: "Editar un producto",
    claves: ["editar producto", "modificar producto", "cambiar nombre", "cambiar descripcion", "corregir producto", "foto", "imagen", "imagenes"],
    requiere: "editar",
    respuesta: `1. Andá a "Productos" y buscalo por nombre o SKU.
2. Entrá al producto.
3. Cambiá lo que necesites (datos, presentaciones, precios, imágenes).
4. Tocá "Guardar cambios".
Para el stock usá el botón "Ajustar" al lado de "Stock actual".`,
    relacionados: ["stock-ajustar"],
  },
  {
    id: "producto-duplicar",
    categoria: "Productos",
    titulo: "Duplicar un producto",
    claves: ["duplicar", "copiar producto", "copia"],
    requiere: "editar",
    respuesta: `1. En "Productos", abrí el menú de acciones (los tres puntitos verticales) de la fila.
2. Tocá "Duplicar".
3. Se crea una copia: entrá y cambiá nombre, SKU y lo que haga falta.`,
  },
  {
    id: "producto-baja",
    categoria: "Productos",
    titulo: "Dar de baja o reactivar un producto",
    claves: ["dar de baja", "baja", "borrar producto", "eliminar producto", "ocultar", "reactivar", "inactivo", "desactivar", "dados de baja"],
    requiere: "editar",
    respuesta: `Dar de baja oculta el producto del catálogo pero no lo borra.
1. En "Productos", abrí el menú de acciones de la fila.
2. Tocá "Dar de baja" y confirmá.
Para recuperarlo: prendé "Ver dados de baja" en los filtros, buscá el producto y tocá "Reactivar".
También podés poner el Estado en "Inactivo" desde la edición del producto.`,
  },
  {
    id: "producto-filtros",
    categoria: "Productos",
    titulo: "Filtrar el listado de productos",
    claves: ["filtrar", "filtro", "filtros", "listado", "por categoria", "por marca", "por proveedor"],
    respuesta: `En "Productos" podés:
- Buscar por nombre o SKU (con permiso de costos, también por marca o proveedor).
- Filtrar por categoría, estado (Activos / Inactivos) y stock (Stock bajo / Stock ok).
- Con permiso de costos: filtrar por marca y proveedor.
- Prender "Ver dados de baja" para ver los productos dados de baja.`,
  },
  {
    id: "producto-historial",
    categoria: "Productos",
    titulo: "Ver el historial de un producto",
    claves: ["historial", "quien cambio", "cambios del producto", "precio anterior", "historia"],
    respuesta: `1. Entrá al producto desde "Productos".
2. Abrí su historial: ahí está cada cambio con quién lo hizo, cuándo y el valor anterior → nuevo.
Para ver cambios de todo el catálogo usá "Actividad".`,
    relacionados: ["actividad"],
  },
  {
    id: "imprimir",
    categoria: "Productos",
    titulo: "Imprimir lista, catálogo o etiquetas",
    claves: ["imprimir", "impresion", "pdf", "etiquetas", "gondola", "lista de precios", "catalogo revendedores", "lista para pedido", "conteo"],
    respuesta: `1. Andá a "Productos" (podés filtrar antes).
2. Tocá el botón de imprimir y elegí:
- "Catálogo para revendedores"
- "Etiquetas de góndola"
- "Lista para pedido / conteo"
3. Se abre una vista lista para imprimir. Para PDF elegí "Guardar como PDF" en la ventana de impresión del navegador.`,
  },
  {
    id: "categorias",
    categoria: "Productos",
    titulo: "Crear, ordenar o borrar categorías",
    claves: ["categoria", "categorias", "subcategoria", "rubro", "nueva categoria", "ordenar categorias"],
    requiere: "editar",
    respuesta: `1. Andá a "Categorías".
2. "Nueva categoría": escribí el nombre y elegí si es "Categoría raíz" o va adentro de otra.
3. En cada categoría podés "Renombrar", ordenarla con "Subir" / "Bajar", marcarla inactiva o "Eliminar".
Antes de eliminar una categoría con productos, pasá esos productos a otra.`,
  },

  // ───────────────────────── Stock
  {
    id: "stock-ajustar",
    categoria: "Stock",
    titulo: "Ajustar stock (ingreso, venta, rotura)",
    claves: ["stock", "ajustar stock", "ingreso de mercaderia", "entro mercaderia", "llego mercaderia", "sumar stock", "restar stock", "merma", "rotura", "roto", "inventario", "existencias"],
    requiere: "editar",
    respuesta: `1. Entrá al producto desde "Productos".
2. En la presentación, al lado de "Stock actual", tocá "Ajustar".
3. Elegí "sumar", "restar" o "fijar".
4. Poné la cantidad y el motivo: Ingreso de mercadería, Venta, Merma / rotura, Ajuste manual o Conteo de inventario.
5. Si querés, agregá una nota (ej: N° de remito) y confirmá.
El ajuste queda registrado en "Actividad".`,
    relacionados: ["stock-conteo", "stock-bajo"],
  },
  {
    id: "stock-conteo",
    categoria: "Stock",
    titulo: "Cargar un conteo de inventario",
    claves: ["conteo", "stock", "contar", "recuento", "inventario fisico", "fijar stock", "stock real"],
    requiere: "editar",
    respuesta: `Para poner el número exacto que contaste:
1. Imprimí la "Lista para pedido / conteo" desde "Productos" si te sirve para contar.
2. Entrá a cada producto y, en la presentación, tocá "Ajustar" (al lado del stock) y elegí "fijar".
3. Poné la cantidad contada y el motivo "Conteo de inventario".
4. Confirmá. El sistema calcula la diferencia solo.`,
    relacionados: ["imprimir"],
  },
  {
    id: "stock-bajo",
    categoria: "Stock",
    titulo: "Stock bajo y stock mínimo",
    claves: ["stock bajo", "stock minimo", "faltante", "reponer", "alerta", "poco stock", "sin stock"],
    respuesta: `Cada presentación tiene un "Stock mínimo". Cuando el stock queda igual o por debajo, se marca como stock bajo.
- Para verlos todos: en "Inicio" tocá la tarjeta "Stock bajo", o en "Productos" filtrá por "Stock bajo".
- Para cambiar el mínimo: entrá al producto, cambiá "Stock mínimo" en la presentación y "Guardar cambios".`,
  },
  {
    id: "stock-errores",
    categoria: "Stock",
    titulo: "Error al ajustar stock",
    claves: ["el ajuste no cambia el stock", "ingresa una cantidad", "error stock"],
    respuesta: `- "Ingresá una cantidad": falta el número.
- "El ajuste no cambia el stock": el resultado da igual al stock actual (por ejemplo, elegiste "fijar" con el mismo número). Revisá si querías sumar o restar.`,
  },

  // ───────────────────────── Ventas
  {
    id: "venta-nueva",
    categoria: "Ventas",
    titulo: "Cargar una venta",
    claves: ["venta", "vender", "nueva venta", "cargar venta", "pedido nuevo", "cargar pedido", "armar pedido", "cargo venta", "registro venta", "mostrador"],
    requiere: "editar",
    respuesta: `1. Andá a "Ventas" → "Nueva venta" (o desde la ficha del cliente, "Nueva venta").
2. Elegí el cliente. Sin cliente es consumidor final y solo puede ser de contado.
3. Elegí la condición de pago: Contado o Cuenta corriente (con fecha de vencimiento).
4. Agregá productos con el buscador (nombre, marca, SKU o código de barras) y poné las cantidades. El precio sale solo: el especial del cliente si tiene, si no el de su nivel.
5. "Confirmar venta" descuenta el stock. Si es de contado te pide cómo paga (o "cobrar al entregar"); si es a cuenta corriente carga la deuda. "Guardar como Nuevo" lo deja pendiente para confirmar después.`,
    relacionados: ["venta-estados", "venta-precio", "venta-stock"],
  },
  {
    id: "venta-estados",
    categoria: "Ventas",
    titulo: "Estados de un pedido (confirmar, preparar, entregar)",
    claves: ["estado pedido", "confirmar pedido", "preparando", "en reparto", "entregado", "pedido entregado", "paso entregado", "despachar", "entregar pedido", "seguimiento", "bandeja"],
    requiere: "editar",
    respuesta: `Un pedido pasa por: Nuevo → Confirmado → Preparando → En reparto → Entregado.
- Nuevo: todavía no tocó stock ni deuda. Se puede editar.
- Al confirmarlo se descuenta el stock y se carga la deuda si es a cuenta corriente. Ya no se edita.
- Desde el pedido avanzás de estado con los botones (podés saltar directo a Entregado si es de mostrador).
En "Ventas" las pestañas muestran cuántos hay en cada estado; el número rojo son los Nuevos sin confirmar.`,
    relacionados: ["venta-cancelar", "venta-canales"],
  },
  {
    id: "venta-precio",
    categoria: "Ventas",
    titulo: "Cambiar el precio en una venta (único o fijo para el cliente)",
    claves: ["cambiar precio venta", "descuento", "precio en la venta", "rebaja", "precio solo esta venta", "precio unico venta", "dejar precio fijo", "bonificar", "descuento venta", "solo esta venta"],
    requiere: "precios_especiales",
    respuesta: `1. En la venta, en el renglón tocá "Cambiar" al lado del precio.
2. Poné el precio nuevo y el motivo (obligatorio).
3. Elegí:
- Sin marcar nada: el precio vale SOLO para esta venta.
- Marcando "Dejar este precio fijo para el cliente": al confirmar queda como precio especial del cliente para las próximas compras.
Por debajo del costo solo lo puede hacer un administrador. Todo queda en "Actividad".`,
    relacionados: ["precio-especial", "venta-nueva"],
  },
  {
    id: "venta-stock",
    categoria: "Ventas",
    titulo: "No me deja confirmar: no hay stock o supera el límite",
    claves: ["no hay stock", "stock suficiente", "no me deja confirmar", "limite cuenta corriente", "supera el limite", "limite de credito", "no alcanza"],
    respuesta: `- "No hay stock suficiente": el stock no alcanza para lo que pide. Guardalo como Nuevo y confirmalo cuando entre la mercadería (cargala con un ajuste de stock "Ingreso").
- "Supera su límite de cuenta corriente": con esa venta el cliente pasa su límite. Solo un administrador puede confirmarla, o cobrale antes y bajá su saldo.`,
    relacionados: ["stock-ajustar", "caja-cobrar"],
  },
  {
    id: "venta-cancelar",
    categoria: "Ventas",
    titulo: "Cancelar un pedido",
    claves: ["cancelar pedido", "cancelo pedido", "cancelar", "cancelo", "anular pedido", "anular venta", "borrar pedido", "se arrepintio", "pedido duplicado"],
    requiere: "editar",
    respuesta: `1. Entrá al pedido y tocá "Cancelar pedido".
2. Escribí el motivo y confirmá.
- Un pedido Nuevo lo cancela cualquiera que pueda vender.
- Uno ya confirmado lo cancela solo un administrador: se devuelve el stock y se anula el cargo de la cuenta corriente.
- Un pedido Entregado no se cancela.`,
    relacionados: ["venta-estados"],
  },
  {
    id: "venta-canales",
    categoria: "Ventas",
    titulo: "Pedidos de la tienda online y de WhatsApp",
    claves: ["tienda online", "pedido web", "whatsapp", "bot", "pedidos de la tienda", "canal", "canales", "clave", "api pedidos", "n8n"],
    respuesta: `Los pedidos de las tiendas y del bot de WhatsApp caen en "Ventas" como Nuevo, junto con los del panel.
- Llegan al precio general. Si es un cliente cargado, editá el pedido, elegí el cliente y los precios se recalculan con su nivel.
- No tocan stock ni deuda hasta que alguien los confirma.
- Las claves de cada canal las crea un administrador en "Ventas" → "Canales". Si una tienda deja de cargar pedidos, revisá que su clave esté activa.`,
    relacionados: ["venta-estados"],
  },

  // ───────────────────────── Caja
  {
    id: "caja-abrir",
    categoria: "Caja",
    titulo: "Abrir mi caja",
    claves: ["abrir caja", "abro la caja", "caja", "empezar el dia", "inicio de caja", "cambio inicial", "mi caja"],
    requiere: "editar",
    respuesta: `Cada uno cobra con su propia caja.
1. Andá a "Caja".
2. Poné el efectivo con el que arrancás (el cambio que tenés; puede ser 0).
3. "Abrir caja".
Sin la caja abierta no podés cobrar ni confirmar ventas de contado cobrando en el momento.`,
    relacionados: ["caja-cobrar", "caja-cerrar"],
  },
  {
    id: "caja-cobrar",
    categoria: "Caja",
    titulo: "Cobrarle a un cliente (pago de cuenta corriente)",
    claves: ["cobrar", "cobro", "pago", "registrar pago", "pago recibido", "me pago", "pago cliente", "recibo", "registrar cobro", "cobranza", "pago de deuda", "transferencia", "mercado pago", "tarjeta"],
    requiere: "editar",
    respuesta: `1. Entrá al cliente → "Cuenta corriente" → "Registrar cobro" (o desde "Caja" → "Cobrar a un cliente").
2. Elegí cómo paga: efectivo, transferencia, Mercado Pago o tarjeta. Puede ser más de uno (ej: parte en efectivo y parte por transferencia). Para transferencias y MP anotá el N° de operación.
3. "Registrar cobro". Se descuenta de su deuda y sale un recibo numerado para imprimir. Si el cliente tiene email, se lo mandamos.
Los pagos ya no se cargan a mano en la cuenta corriente: pasan por la caja para que quede el recibo.`,
    relacionados: ["caja-abrir", "recibo-anular"],
  },
  {
    id: "caja-venta-contado",
    categoria: "Caja",
    titulo: "Cobrar una venta de contado",
    claves: ["venta contado", "cobrar venta", "contado", "vuelto", "contra entrega", "cobrar al entregar", "a cobrar", "falta cobrar"],
    requiere: "editar",
    respuesta: `Al confirmar una venta de contado te pide cómo paga:
- Cargá el medio y el importe. Si te da de más en efectivo, te calcula el vuelto.
- O marcá "Cobrar al entregar" (contra entrega): se confirma sin cobrar y queda "A cobrar".
Un pedido "A cobrar" no se puede marcar Entregado hasta registrar el cobro: entrá al pedido → "Registrar cobro".`,
    relacionados: ["venta-nueva", "caja-abrir"],
  },
  {
    id: "caja-cerrar",
    categoria: "Caja",
    titulo: "Cerrar la caja (arqueo)",
    claves: ["cerrar caja", "cierre de caja", "arqueo", "fin del dia", "rendir caja", "contar plata", "faltante", "sobrante", "diferencia de caja"],
    requiere: "editar",
    respuesta: `1. En "Caja" tocá "Cerrar caja".
2. Contá el efectivo que hay y anotalo. Solo efectivo: transferencias, MP y tarjetas no se cuentan.
3. Si no coincide con lo esperado, te pide una nota explicando la diferencia (sobrante o faltante).
Lo esperado = efectivo inicial + efectivo cobrado + ingresos − egresos. La diferencia queda registrada y la ve el encargado.`,
    relacionados: ["caja-egreso"],
  },
  {
    id: "caja-egreso",
    categoria: "Caja",
    titulo: "Sacar o poner plata en la caja (egreso / ingreso)",
    claves: ["egreso", "ingreso", "retiro", "sacar plata", "retirar efectivo", "gasto", "pagar flete", "poner cambio"],
    requiere: "editar",
    respuesta: `1. En "Caja" tocá "Ingreso / egreso".
2. Elegí si sale (egreso) o entra (ingreso) plata, el importe y el motivo (ej: "retiro para el dueño", "pago de flete").
Es solo efectivo y queda con tu nombre. Se tiene en cuenta en el arqueo.`,
    relacionados: ["caja-cerrar"],
  },
  {
    id: "recibo-anular",
    categoria: "Caja",
    titulo: "Me equivoqué en un cobro (anular recibo)",
    claves: ["anular recibo", "recibo mal", "cobre mal", "cobro mal", "borrar cobro", "borrar pago", "reimprimir recibo", "mandar recibo"],
    requiere: "caja_admin",
    respuesta: `Los recibos no se borran: se anulan con motivo.
1. En "Caja" (o la caja de esa persona) buscá el recibo y tocá el ícono de anular.
2. Escribí el motivo y confirmá.
Si era un pago de cuenta corriente, la deuda del cliente vuelve a subir; si era de un pedido, vuelve a quedar "A cobrar". Después registrá el cobro bien.
Para reimprimir o reenviar por mail, abrí el recibo tocando su número.`,
    relacionados: ["caja-cobrar"],
  },

  // ───────────────────────── Precios
  {
    id: "precio-uno",
    categoria: "Precios",
    titulo: "Cambiar el precio de un producto",
    claves: ["cambiar precio", "precio de un producto", "modificar precio", "precio", "precios", "actualizar precio"],
    requiere: "precios_lote",
    respuesta: `Ojo: esto cambia el precio para TODOS los clientes de ese nivel y en la tienda online. Si es solo para un cliente, usá un precio especial.
1. Entrá al producto desde "Productos".
2. En "Presentaciones y precios" cambiá el precio del nivel que corresponda. El casillero chico de al lado es el % de ganancia sobre el costo: si ponés el %, el precio se calcula solo.
3. Si un precio queda por debajo del costo se marca en rojo y te pide confirmar antes de guardar.
4. "Guardar cambios".
Un empleado sin el permiso de precios puede poner precio a un producto nuevo, pero no cambiar uno ya cargado.`,
    relacionados: ["precio-especial", "precio-lote", "precio-niveles"],
  },
  {
    id: "precio-lote",
    categoria: "Precios",
    titulo: "Aumentar precios en lote (varios productos)",
    claves: ["aumento", "aumentar", "en lote", "masivo", "remarcar", "inflacion", "subir precios", "bajar precios", "porcentaje", "reprecio", "margen", "todos los precios"],
    requiere: "precios_lote",
    respuesta: `Se hace desde "Productos", sobre lo que quede filtrado en pantalla:
1. Andá a "Productos" y filtrá (por marca, proveedor, categoría o búsqueda).
2. Abrí el cambio de precios y elegí la operación: "Aumentar / bajar un %", "Sumar / restar un monto", "Fijar un precio" o "Fijar margen sobre el costo".
3. Elegí los "Niveles afectados" y poné el valor.
4. Revisá la vista previa y tocá "Aplicar cambio de precios".
Si dice "Ningún precio coincide con los filtros", revisá filtros y niveles.`,
    relacionados: ["precio-error"],
  },
  {
    id: "precio-error",
    categoria: "Precios",
    titulo: "Me equivoqué con un aumento de precios",
    claves: ["me equivoque", "deshacer", "volver atras", "revertir", "error aumento", "aumente mal"],
    requiere: "precios_lote",
    respuesta: `No hay botón de deshacer, pero se corrige así:
- Si subiste un % por error, aplicá la baja equivalente con los mismos filtros. Ej: subiste 10% → bajá 9,09%. Subiste 20% → bajá 16,67%.
- Si fue un monto, restá el mismo monto.
- Para ver los valores anteriores exactos, mirá "Actividad" (filtrá por acción "Actualización de precios en lote").`,
    relacionados: ["actividad"],
  },
  {
    id: "precio-niveles",
    categoria: "Precios",
    titulo: "Niveles de precio (mayorista, minorista…)",
    claves: ["nivel de precio", "niveles", "lista de precio", "mayorista", "minorista", "consumidor final", "nivel por defecto"],
    requiere: "precios_lote",
    respuesta: `Los niveles son las listas de precio del catálogo.
1. Andá a "Precios".
2. Para crear uno escribí el nombre en "Nuevo nivel" y guardá.
3. Podés renombrarlo, eliminarlo o marcarlo como nivel por defecto.
Podés tener todos los niveles que necesites (ej: Minorista, Mayorista 1, Mayorista 2, Mayorista 3, Revendedor, Supermercado).
Después de crear un nivel nuevo, cargale precios a los productos (a mano, con reprecio en lote o con carga masiva).
Cambiar el nivel de un cliente también requiere este permiso.`,
    relacionados: ["precio-especial"],
  },
  {
    id: "precio-especial",
    categoria: "Precios",
    titulo: "Precio especial para un cliente",
    claves: ["precio especial", "precio especial cliente", "precio distinto", "precio para un cliente", "descuento cliente", "precio unico", "solo para un cliente", "acuerdo", "precio pactado", "condicion especial"],
    requiere: "precios_especiales",
    respuesta: `Sirve para darle a UN cliente un precio distinto en un producto, sin cambiar el precio general, el de otros clientes ni la tienda online.
1. Andá a "Clientes" y entrá al cliente.
2. En "Precios especiales" tocá "Agregar".
3. Buscá el producto y elegí la presentación. Ves el precio general que le corresponde (el de su nivel).
4. Poné el precio especial, el motivo (obligatorio) y, si querés, hasta qué día vale.
5. "Guardar". Para volver al precio general, tocá el tachito.
- Todo queda registrado en "Actividad" con quién lo dio.
- Un precio por debajo del costo solo lo puede dar un administrador.
- Aplicarlo solo a una venta puntual va a llegar con el módulo de Ventas.`,
    relacionados: ["precio-uno", "precio-niveles"],
  },

  // ───────────────────────── Clientes
  {
    id: "cliente-nuevo",
    categoria: "Clientes",
    titulo: "Cargar un cliente nuevo",
    claves: ["cliente nuevo", "nuevo cliente", "cargar cliente", "alta cliente", "agregar cliente", "cliente"],
    requiere: "editar",
    respuesta: `1. Andá a "Clientes" → "Nuevo cliente".
2. Completá Nombre / Razón social (obligatorio).
3. Opcional: Tipo y número de documento, Condición IVA, Email, Teléfono, Dirección, Ciudad, Provincia, Nivel de precio por defecto, Vendedor asignado, Límite de cuenta corriente y Notas.
4. "Crear cliente".
Cargale el email: lo usan los avisos automáticos de vencimiento.`,
    relacionados: ["cc-cargar"],
  },
  {
    id: "cc-cargar",
    categoria: "Clientes",
    titulo: "Movimientos de cuenta corriente (cargos, notas, ajustes)",
    claves: ["cuenta corriente", "cliente", "registrar", "cargo", "factura", "fiado", "deuda", "saldo", "nota de credito", "nota de debito", "movimiento cuenta"],
    requiere: "editar",
    respuesta: `1. Andá a "Clientes" y entrá al cliente.
2. En "Cuenta corriente" agregá un movimiento.
3. Elegí el tipo:
- "Cargo (venta / factura)": suma deuda y lleva fecha de vencimiento. Las ventas a cuenta corriente confirmadas en "Ventas" ya cargan el cargo solas.
- Los pagos se registran con "Registrar cobro" (pasan por tu caja y sale recibo).
- "Pago recibido" a mano, "Nota de crédito", "Nota de débito" y "Ajuste manual": solo con el permiso de cuenta corriente (o un administrador), porque pueden borrar deuda.
4. Poné el importe, el vencimiento si corresponde y una nota (ej: N° de comprobante).
5. Guardá. El saldo se recalcula solo.`,
    relacionados: ["cc-corregir", "cc-deudores"],
  },
  {
    id: "cc-corregir",
    categoria: "Clientes",
    titulo: "Corregir o borrar un movimiento de cuenta corriente",
    claves: ["borrar movimiento", "eliminar movimiento", "corregir movimiento", "movimiento mal", "cargue mal", "pago mal"],
    requiere: "cuenta_corriente_admin",
    respuesta: `Con este permiso también podés cargar notas de crédito/débito y ajustes manuales.
1. Entrá al cliente → "Cuenta corriente".
2. En el movimiento equivocado tocá "Eliminar movimiento" y confirmá.
3. Cargalo de nuevo bien.
El saldo se recalcula y queda registrado en "Actividad".`,
  },
  {
    id: "cc-deudores",
    categoria: "Clientes",
    titulo: "Ver quién debe o está en mora",
    claves: ["deudores", "quien debe", "mora", "vencido", "atrasado", "con deuda", "morosos"],
    respuesta: `1. Andá a "Clientes".
2. Usá el filtro de deuda: "Con deuda" (tiene saldo pendiente) o "En mora" (tiene un vencimiento ya pasado).
3. También podés filtrar por vendedor.
Entrando al cliente ves el saldo y el próximo vencimiento.`,
  },
  {
    id: "cc-avisos",
    categoria: "Clientes",
    titulo: "Avisos automáticos de vencimiento por mail",
    claves: ["aviso", "avisos", "mail", "email", "recordatorio", "vencimiento", "notificacion"],
    respuesta: `Todos los días el sistema avisa por mail a los clientes que tienen un vencimiento en los próximos 4 días, y también a su vendedor asignado.
- El cliente tiene que tener email cargado.
- Si los mails no llegan, puede que el envío todavía no esté configurado: avisale al desarrollador.`,
  },

  // ───────────────────────── Proveedores
  {
    id: "proveedor-nuevo",
    categoria: "Proveedores",
    titulo: "Cargar un proveedor",
    claves: ["proveedor nuevo", "nuevo proveedor", "cargar proveedor", "alta proveedor", "proveedor", "proveedores"],
    requiere: "editar",
    respuesta: `1. Andá a "Proveedores" → "Nuevo proveedor".
2. Completá Nombre / Razón social (obligatorio).
3. Opcional: documento, Persona de contacto, Email, Teléfono, dirección, Condición de pago (ej: Contado, 30 días) y Notas.
4. "Crear proveedor".`,
    relacionados: ["proveedor-productos"],
  },
  {
    id: "proveedor-productos",
    categoria: "Proveedores",
    titulo: "Asignar productos a un proveedor",
    claves: ["productos del proveedor", "asignar proveedor", "proveedor principal", "costo proveedor", "quien me vende"],
    requiere: "costos",
    respuesta: `Desde el proveedor:
1. Entrá al proveedor y buscá el producto por nombre, SKU o marca para agregarlo.
2. Cargá el costo. Podés marcarlo como "Principal" o quitarlo del proveedor.
Desde el producto: en "Proveedores del producto" elegís el proveedor, su costo y cuál es el principal.`,
  },
  {
    id: "proveedor-costos",
    categoria: "Proveedores",
    titulo: "El proveedor aumentó: actualizar costos",
    claves: ["lista nueva", "aumento proveedor", "actualizar costos", "costo", "costos", "subio el proveedor"],
    requiere: "costos",
    respuesta: `1. Entrá al proveedor.
2. Usá "Actualizar costos del proveedor": "Subir / bajar un %" o "Fijar un costo".
3. Confirmá: se aplica a todos sus productos.
4. Si querés pasarlo al precio de venta, andá a "Productos", filtrá por ese proveedor y aplicá "Fijar margen sobre el costo" (necesita permiso de precios en lote).`,
    relacionados: ["precio-lote"],
  },

  // ───────────────────────── Promos
  {
    id: "promos",
    categoria: "Promos",
    titulo: "Armar promos, destacados y carrusel",
    claves: ["promo", "promos", "promocion", "oferta", "ofertas", "descuento", "carrusel", "slide", "destacado", "destacados", "portada"],
    requiere: "promos",
    respuesta: `Andá a "Promos". Hay tres tipos:
- Carrusel: aparecen en el carrusel de la portada.
- Destacados: aparecen en la sección de destacados.
- Ofertas: producto con descuento ("Porcentaje %" o "Monto fijo").
Para agregar una:
1. Buscá el producto.
2. Opcional: Título, Subtítulo, Link (si los dejás vacíos se completan solos) y fechas "Desde" / "Hasta" para que empiece y termine sola.
3. Guardá.
Eliminar una promo no afecta al producto.`,
  },

  // ───────────────────────── Carga masiva
  {
    id: "carga-masiva",
    categoria: "Carga masiva",
    titulo: "Cargar muchos productos con Excel",
    claves: ["excel", "csv", "planilla", "importar", "importacion", "carga masiva", "subir archivo", "plantilla"],
    requiere: "carga_masiva",
    respuesta: `1. Andá a "Carga masiva".
2. Paso 1 · Plantilla: descargala (CSV o Excel) y completala.
3. Paso 2 · Subir archivo: elegí tu planilla.
4. Paso 3 · Vista previa: revisá cada fila; las que tienen error dicen por qué.
5. Confirmá: se importan solo las filas válidas.
Reglas: filas con el mismo sku_base son presentaciones de un mismo producto, el sku no se puede repetir, la categoría tiene que existir antes y el máximo es 2000 filas.`,
    relacionados: ["carga-columnas", "carga-errores"],
  },
  {
    id: "carga-columnas",
    categoria: "Carga masiva",
    titulo: "Columnas de la planilla de importación",
    claves: ["columnas", "sku_base", "formato planilla", "como completar", "campos"],
    requiere: "carga_masiva",
    respuesta: `Obligatorias: nombre, sku_base, categoria, presentacion, sku.
Opcionales: marca, descripcion, estado (active o inactive), tamano, unidad (ml, l, g, kg o u), codigo_barras, stock, stock_minimo.
Precios: una columna precio_<nivel> por cada nivel de precio del catálogo (vienen en la plantilla).
Usá siempre la plantilla descargada del panel: ya trae las columnas correctas.`,
  },
  {
    id: "carga-errores",
    categoria: "Carga masiva",
    titulo: "Errores al importar la planilla",
    claves: ["no se pudo leer el archivo", "no hay filas validas", "no tiene filas", "error importar", "fila con error"],
    requiere: "carga_masiva",
    respuesta: `- "El archivo no tiene filas de datos.": la planilla está vacía o le falta la fila de encabezados.
- "No hay filas válidas para importar.": todas tienen error; mirá la columna de error en la vista previa.
- "No se pudo leer el archivo": guardalo como .xlsx o .csv y probá de nuevo.
- "Máximo 2000 filas por importación.": partí la planilla en varias.
Errores comunes por fila: categoría que no existe, sku repetido o falta un campo obligatorio.`,
  },

  // ───────────────────────── Usuarios
  {
    id: "usuarios-agregar",
    categoria: "Usuarios",
    titulo: "Agregar un usuario o empleado",
    claves: ["agregar usuario", "nuevo usuario", "nuevo empleado", "dar acceso", "usuario", "usuarios", "empleado nuevo", "invitar"],
    requiere: "usuarios",
    respuesta: `1. Andá a "Usuarios" → "Agregar usuario".
2. Poné el Email y, si querés, el Nombre.
3. Elegí el Rol: Administrador, Empleado o Solo lectura.
4. Si es Empleado, prendé los "Permisos extra" que necesite.
5. Guardá.
Solo un administrador puede crear otros administradores.`,
    relacionados: ["usuarios-permisos", "usuarios-quitar"],
  },
  {
    id: "usuarios-permisos",
    categoria: "Usuarios",
    titulo: "Cambiar el rol o los permisos de alguien",
    claves: ["cambiar rol", "dar permiso", "prender permiso", "quitar permiso", "hacer admin", "permisos extra"],
    requiere: "usuarios",
    respuesta: `1. Andá a "Usuarios".
2. En la persona cambiá el Rol o prendé / apagá los permisos extra.
3. Guardá. El cambio aplica la próxima vez que cargue una pantalla.
Permisos extra para empleados: precios (cambiar precios ya cargados, niveles, en lote y el nivel de un cliente), precios especiales por cliente, ver costos y proveedores, carga masiva, promos, cuenta corriente (ajustes, notas y correcciones) y gestionar usuarios.`,
  },
  {
    id: "usuarios-quitar",
    categoria: "Usuarios",
    titulo: "Sacarle el acceso a alguien",
    claves: ["quitar usuario", "sacar acceso", "eliminar usuario", "dejo de trabajar", "se fue", "bloquear"],
    requiere: "usuarios",
    respuesta: `1. Andá a "Usuarios".
2. En la persona tocá "Quitar del catálogo" y confirmá.
Deja de tener acceso a ese catálogo. Sus cambios anteriores siguen en "Actividad".`,
  },
  {
    id: "catalogos",
    categoria: "Usuarios",
    titulo: "Crear un catálogo nuevo",
    claves: ["crear catalogo", "nuevo catalogo", "catalogos"],
    requiere: "superadmin",
    respuesta: `Solo el administrador general.
1. Volvé al selector ("Cambiar catálogo").
2. Tocá "Administrar catálogos y usuarios" y usá "Nuevo catálogo" (nombre y slug opcional).
3. Asignale usuarios con su rol.`,
  },

  // ───────────────────────── Facturación
  {
    id: "facturacion",
    categoria: "Facturación",
    titulo: "Facturación electrónica (AFIP / ARCA)",
    claves: ["facturar", "facturacion", "afip", "arca", "comprobante", "cae", "factura electronica", "tusfacturas"],
    requiere: "admin",
    respuesta: `La facturación electrónica funciona a través de TusFacturasAPP.
- En "Facturación" ves si está conectada.
- Si dice "Todavía no está conectada", faltan las credenciales: eso lo carga el desarrollador en el servidor. Nunca compartas claves por chat.
- Un comprobante emitido no se puede editar ni borrar: solo se anula con una nota de crédito.`,
  },

  // ───────────────────────── Actividad
  {
    id: "actividad",
    categoria: "Actividad",
    titulo: "Ver quién cambió algo (auditoría)",
    claves: ["actividad", "auditoria", "quien", "quien hizo", "quien modifico", "registro", "log", "cambios"],
    respuesta: `Todo cambio queda registrado con quién, cuándo y el valor anterior → nuevo.
1. Andá a "Actividad".
2. Filtrá por tipo de acción, usuario, producto o fechas (desde / hasta).
3. Abrí la entrada para ver el detalle.
Las importaciones masivas tienen su propia página de detalle.`,
  },

  // ───────────────────────── Problemas
  {
    id: "error-general",
    categoria: "Problemas",
    titulo: "Algo no anda o me sale un error",
    claves: ["error", "no anda", "no funciona", "se colgo", "pantalla en blanco", "falla", "bug", "roto", "no carga", "lento"],
    respuesta: `Probá en este orden:
1. Recargá la página (F5).
2. Cerrá sesión y volvé a entrar.
3. Probá en otra pestaña o en otro navegador.
Si sigue, anotá qué estabas haciendo, el mensaje exacto (si podés, sacale captura) y la hora, y pasáselo al desarrollador.`,
  },
  {
    id: "error-permiso",
    categoria: "Problemas",
    titulo: "Me dice que no tengo permiso",
    claves: ["no tenes permiso", "solo para administradores", "sin permiso", "no me deja", "no puedo editar"],
    respuesta: `- "No tenés permiso de edición en este catálogo": tu usuario es de solo lectura.
- "Esta acción es solo para administradores del catálogo": lo tiene que hacer un admin.
- "No tenés el permiso "…" en este catálogo": un admin te lo puede prender en "Usuarios".`,
    relacionados: ["roles"],
  },
];

export const TEMA_POR_ID = new Map(TEMAS.map((t) => [t.id, t]));
