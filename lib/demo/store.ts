import { datosIniciales, type Tablas } from "@/lib/demo/datos";

/**
 * Base en memoria del modo demo. Vive en `globalThis` para sobrevivir a la
 * recarga en caliente de `next dev`. Se pierde al reiniciar el servidor.
 */
const g = globalThis as unknown as { __demoTablas?: Tablas };

export function tablas(): Tablas {
  if (!g.__demoTablas) {
    g.__demoTablas = datosIniciales();
    recalcularTodasLasCuentas();
  }
  return g.__demoTablas;
}

export function reiniciarDemo() {
  g.__demoTablas = datosIniciales();
  recalcularTodasLasCuentas();
}

export function tabla(nombre: string): Record<string, unknown>[] {
  const t = tablas();
  if (!t[nombre]) t[nombre] = [];
  return t[nombre];
}

/** Igual que el trigger fn_recalcular_cuenta_cliente: saldo y próximo vencimiento (FIFO). */
export function recalcularCuenta(customerId: string) {
  const cli = tabla("customers").find((c) => c.id === customerId);
  if (!cli) return;
  const movs = tabla("customer_transactions").filter(
    (m) => m.customer_id === customerId && !m.is_deleted,
  );
  const saldo = movs.reduce((a, m) => a + Number(m.amount), 0);
  let creditos = -movs.filter((m) => Number(m.amount) < 0).reduce((a, m) => a + Number(m.amount), 0);
  const cargos = movs
    .filter((m) => Number(m.amount) > 0)
    .sort((a, b) => String(a.due_date ?? "9999").localeCompare(String(b.due_date ?? "9999")));
  let proximo: string | null = null;
  for (const c of cargos) {
    const resto = Number(c.amount) - creditos;
    if (resto > 0.004) {
      proximo = (c.due_date as string | null) ?? null;
      break;
    }
    creditos -= Number(c.amount);
  }
  cli.balance = Math.round(saldo * 100) / 100;
  cli.next_due_date = saldo > 0 ? proximo : null;
}

function recalcularTodasLasCuentas() {
  for (const c of g.__demoTablas!.customers) recalcularCuenta(c.id as string);
}

/** "Transacción" del demo: si una función falla a mitad de camino, se vuelve atrás. */
export function conTransaccion<T>(fn: () => T): T {
  const copia = structuredClone(tablas());
  try {
    return fn();
  } catch (e) {
    g.__demoTablas = copia;
    throw e;
  }
}
