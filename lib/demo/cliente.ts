/**
 * Cliente Supabase falso del modo demo: implementa lo que usa el panel
 * (select con relaciones embebidas, filtros, orden, paginado, conteo,
 * insert/update/upsert/delete, rpc, auth y storage) sobre la base en memoria.
 * NO emula las políticas RLS: las reglas de negocio de las funciones (ventas,
 * caja, precios) sí están portadas en lib/demo/rpc.ts.
 */
import { tabla, recalcularCuenta, conTransaccion } from "@/lib/demo/store";
import { auditar, type Actor } from "@/lib/demo/auditoria";
import { ejecutarRpc } from "@/lib/demo/rpc";
import { USUARIOS_DEMO } from "@/lib/demo/datos";

type Fila = Record<string, unknown>;
type Resultado = { data: unknown; error: { message: string; code?: string } | null; count?: number | null; status: number };

// ------------------------------------------------------------
// Relaciones: tabla → columna FK con la que otras la referencian
// ------------------------------------------------------------
const FK: Record<string, string> = {
  profiles: "user_id",
  customers: "customer_id",
  products: "product_id",
  product_variants: "variant_id",
  orders: "order_id",
  receipts: "receipt_id",
  price_tiers: "price_tier_id",
  categories: "category_id",
  suppliers: "supplier_id",
  cash_sessions: "session_id",
  catalogs: "catalog_id",
  import_batches: "batch_id",
};

type ItemSel =
  | { t: "todo" }
  | { t: "col"; nombre: string; alias: string }
  | { t: "rel"; alias: string | null; tabla: string; inner: boolean; sub: ItemSel[] };

function partirNivelSuperior(s: string): string[] {
  const out: string[] = [];
  let nivel = 0;
  let actual = "";
  for (const ch of s) {
    if (ch === "(") nivel++;
    if (ch === ")") nivel--;
    if (ch === "," && nivel === 0) {
      if (actual.trim()) out.push(actual.trim());
      actual = "";
    } else actual += ch;
  }
  if (actual.trim()) out.push(actual.trim());
  return out;
}

function parsearSeleccion(s: string): ItemSel[] {
  return partirNivelSuperior(s.replace(/\s+/g, " ")).map((tok): ItemSel => {
    const paren = tok.indexOf("(");
    if (paren >= 0) {
      const cabeza = tok.slice(0, paren).trim();
      const cuerpo = tok.slice(paren + 1, tok.lastIndexOf(")"));
      let alias: string | null = null;
      let resto = cabeza;
      if (cabeza.includes(":")) [alias, resto] = cabeza.split(":").map((x) => x.trim());
      const [nombreTabla, ...hints] = resto.split("!");
      return { t: "rel", alias, tabla: nombreTabla, inner: hints.includes("inner"), sub: parsearSeleccion(cuerpo) };
    }
    if (tok === "*") return { t: "todo" };
    const sinCast = tok.split("::")[0];
    if (sinCast.includes(":")) {
      const [alias, nombre] = sinCast.split(":").map((x) => x.trim());
      return { t: "col", nombre, alias };
    }
    return { t: "col", nombre: sinCast, alias: sinCast };
  });
}

function proyectar(fila: Fila, tablaBase: string, items: ItemSel[]): Fila | null {
  const out: Fila = {};
  for (const it of items) {
    if (it.t === "todo") Object.assign(out, fila);
    else if (it.t === "col") out[it.alias] = fila[it.nombre];
    else {
      const clave = it.alias ?? it.tabla;
      const colM2O = it.alias && `${it.alias}_id` in fila ? `${it.alias}_id` : FK[it.tabla];
      if (colM2O && colM2O in fila) {
        const ref = tabla(it.tabla).find((r) => r.id === fila[colM2O]);
        const p = ref ? proyectar(ref, it.tabla, it.sub) : null;
        if (it.inner && !p) return null;
        out[clave] = p;
      } else {
        const back = FK[tablaBase];
        const hijos = tabla(it.tabla)
          .filter((r) => back && r[back] === fila.id)
          .map((r) => proyectar(r, it.tabla, it.sub))
          .filter((x): x is Fila => x !== null);
        if (it.inner && hijos.length === 0) return null;
        out[clave] = hijos;
      }
    }
  }
  return out;
}

// ------------------------------------------------------------
// Filtros
// ------------------------------------------------------------
const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
function igual(a: unknown, b: unknown) {
  if (a == null || b == null) return a == null && b == null;
  return a === b || String(a) === String(b);
}
function comparar(a: unknown, b: unknown): number {
  if (a == null) return -1;
  if (b == null) return 1;
  if (!isNaN(num(a)) && !isNaN(num(b)) && typeof a !== "boolean") return num(a) - num(b);
  return String(a).localeCompare(String(b));
}
function ilike(v: unknown, patron: string) {
  if (v == null) return false;
  const re = new RegExp(
    "^" + patron.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$",
    "i",
  );
  return re.test(String(v));
}
function valorDe(fila: Fila, col: string): unknown {
  return col.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Fila)[k] : undefined), fila);
}
function predicadoOr(expr: string): (f: Fila) => boolean {
  const partes = partirNivelSuperior(expr).map((p) => {
    const m = p.match(/^([a-z_.]+)\.(eq|neq|ilike|like|in|gt|gte|lt|lte|is)\.(.*)$/i);
    if (!m) return () => false;
    const [, col, op, val] = m;
    return (f: Fila) => {
      const v = valorDe(f, col);
      switch (op) {
        case "eq": return igual(v, val);
        case "neq": return !igual(v, val);
        case "ilike":
        case "like": return ilike(v, val);
        case "in": return val.replace(/^\(|\)$/g, "").split(",").some((x) => igual(v, x.replace(/"/g, "")));
        case "gt": return comparar(v, val) > 0;
        case "gte": return comparar(v, val) >= 0;
        case "lt": return comparar(v, val) < 0;
        case "lte": return comparar(v, val) <= 0;
        case "is": return val === "null" ? v == null : igual(v, val);
      }
      return false;
    };
  });
  return (f) => partes.some((p) => p(f));
}

// ------------------------------------------------------------
// Defaults e índices únicos (lo mínimo para que el panel funcione)
// ------------------------------------------------------------
const DEFAULTS: Record<string, Fila> = {
  products: { status: "active", is_deleted: false, attributes: {}, description: null, brand: null, base_sku: null },
  product_variants: { stock: 0, min_stock: 0, is_active: true, is_deleted: false, position: 0, attributes: {}, cost: null, barcode: null },
  customers: { is_active: true, is_deleted: false, balance: 0, next_due_date: null, credit_limit: 0, attributes: {}, tax_condition: "consumidor_final" },
  suppliers: { is_active: true, is_deleted: false, attributes: {} },
  categories: { is_active: true, sort_order: 0, parent_id: null },
  price_tiers: { is_active: true, is_default: false, sort_order: 0 },
  catalogs: { is_active: true, kind: "ecommerce", attributes: {}, logo_path: null },
  catalog_members: { role: "empleado", permissions: [] },
  customer_transactions: { is_deleted: false, order_id: null, receipt_id: null },
  promotions: { is_active: true, position: 1, attributes: {} },
  channel_keys: { is_active: true, last_used_at: null },
  customer_prices: { ends_on: null },
  product_images: { position: 0, is_primary: false },
  profiles: { is_active: true, is_superadmin: false },
};
const UNICOS: Record<string, string[][]> = {
  catalogs: [["slug"]],
  product_variants: [["catalog_id", "sku"]],
  products: [["catalog_id", "base_sku"]],
  customer_prices: [["customer_id", "variant_id"]],
  variant_prices: [["variant_id", "price_tier_id"]],
  catalog_members: [["catalog_id", "user_id"]],
  categories: [["catalog_id", "slug"]],
  price_tiers: [["catalog_id", "code"]],
  product_suppliers: [["product_id", "supplier_id"]],
};

function violaUnico(nombre: string, fila: Fila, excepto?: Fila): boolean {
  return (UNICOS[nombre] ?? []).some((cols) =>
    tabla(nombre).some(
      (r) => r !== excepto && cols.every((c) => fila[c] != null && igual(r[c], fila[c])),
    ),
  );
}

/** Triggers que el panel necesita ver reflejados. */
function despuesDeEscribir(nombre: string, filas: Fila[]) {
  if (nombre === "customer_transactions") {
    for (const f of filas) recalcularCuenta(f.customer_id as string);
  }
  if (nombre === "products") {
    for (const p of filas) {
      if (!p.primary_category_id) continue;
      const pcs = tabla("product_categories");
      for (const pc of pcs) if (pc.product_id === p.id) pc.is_primary = pc.category_id === p.primary_category_id;
      if (!pcs.some((pc) => pc.product_id === p.id && pc.category_id === p.primary_category_id)) {
        pcs.push({ product_id: p.id, category_id: p.primary_category_id, catalog_id: p.catalog_id, is_primary: true, created_at: new Date().toISOString() });
      }
    }
  }
}

// ------------------------------------------------------------
// Query builder
// ------------------------------------------------------------
class Consulta implements PromiseLike<Resultado> {
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private sel: string | null = null;
  private filtros: ((f: Fila) => boolean)[] = [];
  private filtrosRel: ((f: Fila) => boolean)[] = [];
  private ordenes: { col: string; asc: boolean; nullsFirst?: boolean }[] = [];
  private rango: [number, number] | null = null;
  private lim: number | null = null;
  private uno: null | "single" | "maybe" = null;
  private conteo = false;
  private cabecera = false;
  private payload: unknown;
  private onConflict: string | null = null;

  constructor(private actor: Actor, private nombre: string) {}

  select(cols = "*", opts?: { count?: string; head?: boolean }) {
    this.sel = cols;
    if (opts?.count) this.conteo = true;
    if (opts?.head) this.cabecera = true;
    return this;
  }
  insert(rows: unknown) { this.op = "insert"; this.payload = rows; return this; }
  upsert(rows: unknown, opts?: { onConflict?: string }) { this.op = "upsert"; this.payload = rows; this.onConflict = opts?.onConflict ?? null; return this; }
  update(patch: unknown) { this.op = "update"; this.payload = patch; return this; }
  delete() { this.op = "delete"; return this; }

  private f(col: string, fn: (v: unknown) => boolean) {
    const pred = (fila: Fila) => fn(valorDe(fila, col));
    (col.includes(".") ? this.filtrosRel : this.filtros).push(pred);
    return this;
  }
  eq(c: string, v: unknown) { return this.f(c, (x) => igual(x, v)); }
  neq(c: string, v: unknown) { return this.f(c, (x) => !igual(x, v)); }
  gt(c: string, v: unknown) { return this.f(c, (x) => x != null && comparar(x, v) > 0); }
  gte(c: string, v: unknown) { return this.f(c, (x) => x != null && comparar(x, v) >= 0); }
  lt(c: string, v: unknown) { return this.f(c, (x) => x != null && comparar(x, v) < 0); }
  lte(c: string, v: unknown) { return this.f(c, (x) => x != null && comparar(x, v) <= 0); }
  in(c: string, arr: unknown[]) { return this.f(c, (x) => arr.some((a) => igual(x, a))); }
  is(c: string, v: unknown) { return this.f(c, (x) => (v === null ? x == null : igual(x, v))); }
  ilike(c: string, p: string) { return this.f(c, (x) => ilike(x, p)); }
  like(c: string, p: string) { return this.f(c, (x) => ilike(x, p)); }
  contains(c: string, arr: unknown[]) { return this.f(c, (x) => Array.isArray(x) && arr.every((a) => x.includes(a))); }
  match(obj: Fila) { for (const [k, v] of Object.entries(obj)) this.eq(k, v); return this; }
  not(c: string, op: string, v: unknown) {
    if (op === "is") return this.f(c, (x) => (v === null ? x != null : !igual(x, v)));
    if (op === "in") {
      const arr = String(v).replace(/^\(|\)$/g, "").split(",");
      return this.f(c, (x) => !arr.some((a) => igual(x, a)));
    }
    return this.f(c, (x) => !igual(x, v));
  }
  or(expr: string) { this.filtros.push(predicadoOr(expr)); return this; }
  filter(c: string, op: string, v: unknown) {
    return this.f(c, (x) => (op === "eq" ? igual(x, v) : op === "neq" ? !igual(x, v) : true));
  }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.ordenes.push({ col, asc: opts?.ascending !== false, nullsFirst: opts?.nullsFirst });
    return this;
  }
  range(a: number, b: number) { this.rango = [a, b]; return this; }
  limit(n: number) { this.lim = n; return this; }
  single() { this.uno = "single"; return this; }
  maybeSingle() { this.uno = "maybe"; return this; }
  abortSignal() { return this; }

  then<A = Resultado, B = never>(
    ok?: ((v: Resultado) => A | PromiseLike<A>) | null,
    mal?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    let r: Resultado;
    try {
      r = this.ejecutar();
    } catch (e) {
      r = { data: null, error: { message: e instanceof Error ? e.message : String(e) }, status: 400 };
    }
    return Promise.resolve(r).then(ok, mal);
  }

  private coincidentes(): Fila[] {
    return tabla(this.nombre).filter((f) => this.filtros.every((p) => p(f)));
  }

  private devolver(filas: Fila[], total?: number): Resultado {
    const items = parsearSeleccion(this.sel ?? "*");
    let out = filas
      .map((f) => proyectar(f, this.nombre, items))
      .filter((x): x is Fila => x !== null)
      .filter((f) => this.filtrosRel.every((p) => p(f)));
    const count = this.conteo ? out.length : (total ?? null);
    for (const o of [...this.ordenes].reverse()) {
      out = [...out].sort((a, b) => {
        const va = valorDe(a, o.col);
        const vb = valorDe(b, o.col);
        if (va == null && vb == null) return 0;
        if (va == null) return o.nullsFirst ? -1 : 1;
        if (vb == null) return o.nullsFirst ? 1 : -1;
        const c = comparar(va, vb);
        return o.asc ? c : -c;
      });
    }
    if (this.rango) out = out.slice(this.rango[0], this.rango[1] + 1);
    if (this.lim != null) out = out.slice(0, this.lim);
    if (this.cabecera) return { data: null, error: null, count, status: 200 };
    if (this.uno) {
      if (out.length === 0) {
        return this.uno === "single"
          ? { data: null, error: { message: "No se encontró el registro", code: "PGRST116" }, status: 406 }
          : { data: null, error: null, status: 200 };
      }
      return { data: out[0], error: null, count, status: 200 };
    }
    return { data: out, error: null, count, status: 200 };
  }

  private ejecutar(): Resultado {
    const ahora = new Date().toISOString();
    const t = tabla(this.nombre);

    if (this.op === "select") return this.devolver(this.coincidentes());

    if (this.op === "insert" || this.op === "upsert") {
      const filas = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Fila[];
      const escritas: Fila[] = [];
      for (const entrada of filas) {
        if (this.op === "upsert" && this.onConflict) {
          const cols = this.onConflict.split(",").map((c) => c.trim());
          const existente = t.find((r) => cols.every((c) => igual(r[c], entrada[c])));
          if (existente) {
            const antes = { ...existente };
            Object.assign(existente, entrada, { updated_at: ahora });
            auditar(this.actor, this.nombre, antes, existente);
            escritas.push(existente);
            continue;
          }
        }
        const nueva: Fila = {
          id: crypto.randomUUID(), created_at: ahora, updated_at: ahora,
          catalog_id: undefined, ...DEFAULTS[this.nombre], ...entrada,
        };
        if (nueva.catalog_id === undefined) delete nueva.catalog_id;
        if (this.nombre === "catalog_members" || this.nombre === "product_categories" || this.nombre === "product_suppliers") delete nueva.id;
        if (violaUnico(this.nombre, nueva)) {
          return { data: null, error: { message: `duplicate key value violates unique constraint (${this.nombre})`, code: "23505" }, status: 409 };
        }
        t.push(nueva);
        auditar(this.actor, this.nombre, null, nueva);
        escritas.push(nueva);
      }
      despuesDeEscribir(this.nombre, escritas);
      return this.sel ? this.devolver(escritas) : { data: null, error: null, status: 201 };
    }

    if (this.op === "update") {
      const afectadas = this.coincidentes();
      for (const f of afectadas) {
        const antes = { ...f };
        Object.assign(f, this.payload as Fila, { updated_at: ahora });
        if (violaUnico(this.nombre, f, f)) {
          Object.assign(f, antes);
          return { data: null, error: { message: `duplicate key value violates unique constraint (${this.nombre})`, code: "23505" }, status: 409 };
        }
        auditar(this.actor, this.nombre, antes, f);
      }
      despuesDeEscribir(this.nombre, afectadas);
      return this.sel ? this.devolver(afectadas) : { data: null, error: null, status: 204 };
    }

    // delete
    const borrar = this.coincidentes();
    for (const f of borrar) {
      t.splice(t.indexOf(f), 1);
      auditar(this.actor, this.nombre, f, null);
    }
    despuesDeEscribir(this.nombre, borrar);
    return this.sel ? this.devolver(borrar) : { data: null, error: null, status: 204 };
  }
}

// ------------------------------------------------------------
// Cliente
// ------------------------------------------------------------
export function crearClienteDemo(userId: string | null) {
  const perfil = userId ? tabla("profiles").find((p) => p.id === userId) : null;
  const actor: Actor = { uid: perfil ? userId : null, email: (perfil?.email as string) ?? null };
  const user = perfil ? { id: perfil.id as string, email: perfil.email as string } : null;

  return {
    from: (nombre: string) => new Consulta(actor, nombre),
    rpc: async (nombre: string, args: Record<string, unknown> = {}) => {
      try {
        return { data: conTransaccion(() => ejecutarRpc(nombre, args, actor)), error: null, status: 200 };
      } catch (e) {
        return { data: null, error: { message: e instanceof Error ? e.message : String(e) }, status: 400 };
      }
    },
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      getSession: async () => ({ data: { session: user ? { user } : null }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ data: { user }, error: null }),
      admin: {
        createUser: async (opts: { email: string; user_metadata?: { full_name?: string } }) => {
          const nuevo = {
            id: crypto.randomUUID(), email: opts.email, full_name: opts.user_metadata?.full_name ?? null,
            is_superadmin: false, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          };
          tabla("profiles").push(nuevo);
          return { data: { user: { id: nuevo.id, email: nuevo.email } }, error: null };
        },
      },
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: { message: "Subir imágenes no está disponible en el modo demo" } }),
        remove: async () => ({ data: null, error: null }),
        getPublicUrl: (p: string) => ({ data: { publicUrl: p } }),
        createSignedUrl: async () => ({ data: null, error: { message: "No disponible en el modo demo" } }),
        createSignedUploadUrl: async () => ({ data: null, error: { message: "Subir imágenes no está disponible en el modo demo" } }),
      }),
    },
  };
}

export const ID_USUARIO_DEMO_POR_DEFECTO = USUARIOS_DEMO[1].id; // Matías
