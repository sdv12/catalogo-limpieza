/** Datos inventados del modo demo. Se regeneran con "Reiniciar datos". */

type Fila = Record<string, unknown>;
export type Tablas = Record<string, Fila[]>;

/** UUID válido y legible: prefijo de 8 hex + número. */
const uid = (pref: string, n: number) =>
  `${pref.padStart(8, "0")}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

export const USUARIOS_DEMO = [
  { id: uid("a", 1), email: "sergio@demo.local", full_name: "Sergio (administrador general)", is_superadmin: true },
  { id: uid("a", 2), email: "matias@demo.local", full_name: "Matías (administrador)", is_superadmin: false },
  { id: uid("a", 3), email: "lucia@demo.local", full_name: "Lucía (empleada sin permisos)", is_superadmin: false },
  { id: uid("a", 4), email: "pedro@demo.local", full_name: "Pedro (encargado con permisos)", is_superadmin: false },
  { id: uid("a", 5), email: "sofia@demo.local", full_name: "Sofía (solo lectura)", is_superadmin: false },
] as const;

const [SERGIO, MATIAS, LUCIA, PEDRO, SOFIA] = USUARIOS_DEMO.map((u) => u.id);

const CATALOGOS = [
  { id: uid("c", 1), slug: "aura", name: "Aura", kind: "ecommerce" },
  { id: uid("c", 2), slug: "aromas", name: "Aromas Córdoba", kind: "ecommerce" },
  { id: uid("c", 3), slug: "sucursal-centro", name: "Sucursal Centro", kind: "sucursal" },
  { id: uid("c", 4), slug: "sucursal-norte", name: "Sucursal Norte", kind: "sucursal" },
];

const NIVELES = [
  ["Minorista", "minorista", 2.5],
  ["Mayorista 1", "mayorista_1", 1.9],
  ["Mayorista 2", "mayorista_2", 1.85],
  ["Mayorista 3", "mayorista_3", 1.77],
  ["Revendedor", "revendedor", 1.68],
  ["Supermercado", "supermercado", 1.64],
] as const;

const CATEGORIAS = ["Lavandinas", "Detergentes", "Pisos", "Ropa", "Higiene"];

// [nombre, marca, categoría, [presentación, sku, tamaño, unidad, costo, stock, mínimo][]]
const PRODUCTOS: [string, string, number, [string, string, number, string, number, number, number][]][] = [
  ["Lavandina Concentrada", "Clorex", 0, [
    ["1 L", "LAV-1L", 1, "l", 900, 120, 20],
    ["Bidón 5 L", "LAV-5L", 5, "l", 3800, 18, 5],
  ]],
  ["Detergente Limón", "Brillo", 1, [
    ["750 ml", "DET-750", 750, "ml", 1150, 60, 12],
    ["Bidón 5 L", "DET-5L", 5, "l", 6200, 3, 4],
  ]],
  ["Desengrasante Cocina", "Brillo", 1, [["500 ml", "DES-500", 500, "ml", 1900, 25, 6]]],
  ["Limpiador de Pisos Lavanda", "Aromas", 2, [
    ["900 ml", "PIS-900", 900, "ml", 1300, 80, 10],
    ["Bidón 5 L", "PIS-5L", 5, "l", 5400, 2, 3],
  ]],
  ["Suavizante para Ropa", "Suave", 3, [["1 L", "SUA-1L", 1, "l", 1600, 40, 8]]],
  ["Jabón Líquido para Ropa", "Suave", 3, [["3 L", "JAB-3L", 3, "l", 4900, 0, 4]]],
  ["Alcohol en Gel", "Pura", 4, [["250 ml", "ALC-250", 250, "ml", 950, 150, 20]]],
];

const ahora = () => new Date().toISOString();
const diasDesdeHoy = (d: number) => {
  const f = new Date();
  f.setDate(f.getDate() + d);
  return f.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Cordoba" });
};
const haceHoras = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export function datosIniciales(): Tablas {
  const t: Tablas = {
    profiles: [], catalogs: [], catalog_members: [], categories: [], price_tiers: [],
    products: [], product_categories: [], product_variants: [], variant_prices: [],
    product_images: [], stock_movements: [], audit_log: [], customers: [], suppliers: [],
    product_suppliers: [], promotions: [], customer_transactions: [], debt_notifications: [],
    customer_prices: [], orders: [], order_items: [], channel_keys: [], cash_sessions: [],
    receipts: [], receipt_lines: [], cash_movements: [], import_batches: [],
  };

  for (const u of USUARIOS_DEMO) {
    t.profiles.push({ ...u, is_active: true, created_at: ahora(), updated_at: ahora() });
  }

  let n = 0;
  const id = (p: string) => uid(p, ++n);

  for (const c of CATALOGOS) {
    t.catalogs.push({
      ...c, logo_path: null, is_active: true, attributes: {}, created_at: ahora(),
      updated_at: ahora(), created_by: SERGIO,
    });

    // Equipo: Matías admin en todo; el resto según el lugar.
    const miembros: [string, string, string[]][] = [[MATIAS, "admin", []]];
    if (c.slug === "aromas") {
      miembros.push([LUCIA, "empleado", []]);
      miembros.push([PEDRO, "empleado", ["precios_especiales", "caja_admin", "precios_lote", "cuenta_corriente_admin", "costos"]]);
    }
    if (c.slug === "sucursal-centro") miembros.push([LUCIA, "empleado", []]);
    if (c.slug === "aura") miembros.push([SOFIA, "viewer", []]);
    for (const [user_id, role, permissions] of miembros) {
      t.catalog_members.push({ catalog_id: c.id, user_id, role, permissions, created_at: ahora(), created_by: SERGIO });
    }

    const tiers = NIVELES.map(([name, code, factor], i) => {
      const fila = {
        id: id("d"), catalog_id: c.id, name, code, sort_order: i, is_default: i === 0,
        is_active: true, created_at: ahora(), updated_at: ahora(),
      };
      t.price_tiers.push(fila);
      return { id: fila.id, factor };
    });

    const cats = CATEGORIAS.map((name, i) => {
      const fila = {
        id: id("e"), catalog_id: c.id, parent_id: null, name,
        slug: name.toLowerCase(), sort_order: i, is_active: true,
        created_at: ahora(), updated_at: ahora(),
      };
      t.categories.push(fila);
      return fila.id;
    });

    const variantesPorSku = new Map<string, string>();
    for (const [nombre, marca, ci, pres] of PRODUCTOS) {
      const pid = id("f");
      t.products.push({
        id: pid, catalog_id: c.id, name: nombre, description: null, brand: marca,
        base_sku: pres[0][1].split("-")[0], primary_category_id: cats[ci], status: "active",
        is_deleted: false, deleted_at: null, deleted_by: null, attributes: {},
        created_at: haceHoras(500), updated_at: haceHoras(48), created_by: SERGIO, updated_by: SERGIO,
      });
      t.product_categories.push({ product_id: pid, category_id: cats[ci], catalog_id: c.id, is_primary: true, created_at: ahora() });
      pres.forEach(([pn, sku, tam, uni, costo, stock, minimo], pos) => {
        const vid = id("b");
        variantesPorSku.set(sku, vid);
        t.product_variants.push({
          id: vid, catalog_id: c.id, product_id: pid, name: pn, sku, size_value: tam, size_unit: uni,
          barcode: null, stock, min_stock: minimo, cost: costo, is_active: true, is_deleted: false,
          position: pos, attributes: {}, created_at: haceHoras(500), updated_at: haceHoras(48),
          created_by: SERGIO, updated_by: SERGIO,
        });
        for (const tier of tiers) {
          t.variant_prices.push({
            id: id("9"), catalog_id: c.id, variant_id: vid, price_tier_id: tier.id,
            price: Math.round(costo * tier.factor), currency: "ARS",
            created_at: ahora(), updated_at: ahora(), updated_by: SERGIO,
          });
        }
      });
    }

    t.suppliers.push({
      id: id("5"), catalog_id: c.id, name: "Químicos del Centro", doc_type: "CUIT",
      doc_number: "30-71234567-8", contact_name: "Raúl", email: null, phone: "351 555-0101",
      address: null, city: "Córdoba", province: "Córdoba", payment_terms: "30 días", notes: null,
      is_active: true, is_deleted: false, attributes: {}, created_at: ahora(), updated_at: ahora(),
    });

    // Clientes
    const tierId = (code: string) => t.price_tiers.find((x) => x.catalog_id === c.id && x.code === code)!.id;
    const cliente = (name: string, extra: Fila) => {
      const fila = {
        id: id("7"), catalog_id: c.id, name, doc_type: null, doc_number: null,
        tax_condition: "consumidor_final", email: null, phone: null, address: null, city: "Córdoba",
        province: "Córdoba", price_tier_id: null, assigned_seller: null, credit_limit: 0, notes: null,
        is_active: true, is_deleted: false, attributes: {}, balance: 0, next_due_date: null,
        created_at: ahora(), updated_at: ahora(), ...extra,
      };
      t.customers.push(fila);
      return fila.id as string;
    };
    const trebol = cliente("Supermercado El Trébol", {
      doc_type: "CUIT", doc_number: "30-70999888-1", tax_condition: "responsable_inscripto",
      price_tier_id: tierId("supermercado"), credit_limit: 500000, email: "compras@eltrebol.demo",
      assigned_seller: MATIAS,
    });
    const pepe = cliente("Almacén Don Pepe", {
      doc_type: "CUIT", doc_number: "20-28111222-3", tax_condition: "monotributo",
      price_tier_id: tierId("mayorista_1"), credit_limit: 100000, phone: "351 555-0202",
    });
    cliente("María Gómez", { doc_type: "DNI", doc_number: "33444555", email: "maria@demo.local" });
    const total = cliente("Limpieza Total SRL", {
      doc_type: "CUIT", doc_number: "30-71555666-9", tax_condition: "responsable_inscripto",
      price_tier_id: tierId("revendedor"), credit_limit: 300000,
    });

    const mov = (customer_id: string, kind: string, amount: number, due: number | null, note: string) =>
      t.customer_transactions.push({
        id: id("6"), catalog_id: c.id, customer_id, kind, amount, due_date: due == null ? null : diasDesdeHoy(due),
        note, is_deleted: false, created_at: haceHoras(72), updated_at: haceHoras(72),
        created_by: MATIAS, updated_by: MATIAS, order_id: null, receipt_id: null,
      });
    mov(trebol, "cargo", 180000, 10, "Factura A 0001-00001234");
    mov(pepe, "cargo", 95000, -2, "Factura B 0001-00004567");

    t.customer_prices.push({
      id: id("8"), catalog_id: c.id, customer_id: total, variant_id: variantesPorSku.get("LAV-5L"),
      price: 6100, reason: "Acuerdo por volumen mensual", ends_on: null,
      created_at: haceHoras(100), updated_at: haceHoras(100), created_by: MATIAS, updated_by: MATIAS,
    });

    // Pedidos que llegaron por la tienda y por WhatsApp (solo en los ecommerce)
    if (c.kind === "ecommerce") {
      const pedido = (num: number, channel: string, channel_name: string, contacto: string, items: [string, number][], horas: number) => {
        const oid = id("3");
        let tot = 0;
        items.forEach(([sku, q], i) => {
          const v = t.product_variants.find((x) => x.catalog_id === c.id && x.sku === sku)!;
          const p = t.products.find((x) => x.id === v.product_id)!;
          const precio = t.variant_prices.find((x) => x.variant_id === v.id && x.price_tier_id === tiers[0].id)!.price as number;
          tot += precio * q;
          t.order_items.push({
            id: id("2"), catalog_id: c.id, order_id: oid, variant_id: v.id, position: i + 1,
            product_name: p.name, variant_name: v.name, sku, quantity: q, list_price: precio,
            unit_price: precio, price_source: "lista", price_reason: null, save_special: false,
            unit_cost: v.cost, line_total: precio * q, created_at: haceHoras(horas),
          });
        });
        t.orders.push({
          id: oid, catalog_id: c.id, number: num, channel, channel_name, external_ref: `EXT-${num}`,
          status: "nuevo", customer_id: null, contact_name: contacto, contact_phone: "351 555-0303",
          contact_email: null, delivery_address: "Av. Colón 1234, Córdoba", notes: "Entregar por la tarde",
          payment_terms: "contado", due_date: null, total: tot, paid_total: 0, collect_on_delivery: false,
          confirmed_at: null, confirmed_by: null, delivered_at: null, delivered_by: null,
          cancelled_at: null, cancelled_by: null, cancel_reason: null,
          created_at: haceHoras(horas), updated_at: haceHoras(horas), created_by: null, updated_by: null,
        });
      };
      pedido(1, "tienda", `Tienda ${c.name}`, "Juana Pérez", [["LAV-1L", 3], ["DET-750", 2]], 5);
      pedido(2, "whatsapp", "Bot WhatsApp", "Carlos Ruiz", [["PIS-5L", 4]], 2);
      t.channel_keys.push({
        id: id("4"), catalog_id: c.id, channel: "tienda", name: `Tienda ${c.name}`,
        key_prefix: "ped_demo12", key_hash: `demo-${c.slug}`, is_active: true,
        last_used_at: haceHoras(5), created_at: haceHoras(200), updated_at: haceHoras(200),
        created_by: SERGIO, updated_by: SERGIO,
      });
    }

    // Una caja cerrada de ayer con faltante (para ver el arqueo)
    if (c.slug === "aromas") {
      t.cash_sessions.push({
        id: id("1"), catalog_id: c.id, user_id: LUCIA, status: "cerrada", opened_at: haceHoras(30),
        opening_amount: 20000, closed_at: haceHoras(22), closed_by: LUCIA, expected_cash: 20000,
        counted_cash: 19500, difference: -500, closing_note: "Faltó cambio, lo reviso mañana",
        created_at: haceHoras(30), updated_at: haceHoras(22),
      });
    }
  }
  return t;
}
