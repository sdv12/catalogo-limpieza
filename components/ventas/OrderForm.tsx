"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2, X, Pencil, UserRound } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea, FieldHint } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { notificar } from "@/lib/ui";
import { cn } from "@/lib/cn";
import { formatearMoneda, formatearNumero } from "@/lib/format";
import { parsearNumero } from "@/lib/validation/product";
import {
  CONDICIONES_PAGO,
  ETIQUETA_CONDICION_PAGO,
  type CondicionPago,
} from "@/lib/ventas";
import {
  buscarClientesVenta,
  buscarProductosVenta,
  guardarPedido,
  preciosParaCliente,
  type CobroConfirmacion,
  type ProductoVenta,
} from "@/app/panel/[catalogo]/ventas/actions";
import { ModalCobroVenta } from "@/components/caja/ModalCobroVenta";

export type ClienteVenta = {
  id: string;
  name: string;
  doc: string | null;
  balance: number;
  creditLimit: number;
};

export type LineaInicial = {
  variantId: string;
  producto: string;
  presentacion: string;
  sku: string;
  stock: number;
  cantidad: number;
  precioLista: number | null;
  origen: "lista" | "especial";
  costo: number | null;
  /** Precio cambiado a mano en la venta (null = el de lista/especial). */
  precioManual: number | null;
  motivo: string | null;
  guardarFijo: boolean;
};

export type PedidoEditable = {
  id: string;
  number: number;
  cliente: ClienteVenta | null;
  payment: CondicionPago;
  dueDate: string | null;
  notes: string | null;
  lineas: LineaInicial[];
  /** Datos de contacto si vino de una tienda o del bot. */
  contacto: { nombre: string | null; telefono: string | null; email: string | null; direccion: string | null; canal: string } | null;
};

type Linea = {
  key: string;
  variantId: string;
  producto: string;
  presentacion: string;
  sku: string;
  stock: number;
  cantidad: string;
  precioLista: number | null;
  origen: "lista" | "especial";
  costo: number | null;
  editandoPrecio: boolean;
  precioManual: string;
  motivo: string;
  guardarFijo: boolean;
};

let seq = 0;
const nuevaKey = () => `l${++seq}`;

function hoyMas(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString("en-CA");
}

function desdeInicial(l: LineaInicial): Linea {
  return {
    key: nuevaKey(),
    variantId: l.variantId,
    producto: l.producto,
    presentacion: l.presentacion,
    sku: l.sku,
    stock: l.stock,
    cantidad: String(l.cantidad),
    precioLista: l.precioLista,
    origen: l.origen,
    costo: l.costo,
    editandoPrecio: l.precioManual != null,
    precioManual: l.precioManual != null ? String(l.precioManual) : "",
    motivo: l.motivo ?? "",
    guardarFijo: l.guardarFijo,
  };
}

/** Precio efectivo del renglón (manual si se está editando, si no el de lista). */
function precioDe(l: Linea): number | null {
  if (l.editandoPrecio) return parsearNumero(l.precioManual);
  return l.precioLista;
}

export function OrderForm({
  slug,
  pedido,
  clienteInicial,
  puedeCambiarPrecio,
  esAdmin,
}: {
  slug: string;
  pedido?: PedidoEditable;
  /** Venta nueva que arranca con un cliente ya elegido (desde su ficha). */
  clienteInicial?: ClienteVenta | null;
  puedeCambiarPrecio: boolean;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [cliente, setCliente] = useState<ClienteVenta | null>(
    pedido?.cliente ?? clienteInicial ?? null,
  );
  const [payment, setPayment] = useState<CondicionPago>(pedido?.payment ?? "contado");
  const [dueDate, setDueDate] = useState(pedido?.dueDate ?? hoyMas(30));
  const [notes, setNotes] = useState(pedido?.notes ?? "");
  const [lineas, setLineas] = useState<Linea[]>(() => (pedido?.lineas ?? []).map(desdeInicial));
  const [guardando, setGuardando] = useState(false);
  const [cobrando, setCobrando] = useState(false);

  // buscador de clientes
  const [qCliente, setQCliente] = useState("");
  const [resClientes, setResClientes] = useState<ClienteVenta[]>([]);
  useEffect(() => {
    const q = qCliente.trim();
    if (q.length < 2) return;
    const t = setTimeout(async () => setResClientes(await buscarClientesVenta(slug, q)), 300);
    return () => clearTimeout(t);
  }, [qCliente, slug]);

  // buscador de productos
  const [qProd, setQProd] = useState("");
  const [resProd, setResProd] = useState<ProductoVenta[]>([]);
  const [buscandoProd, setBuscandoProd] = useState(false);
  useEffect(() => {
    const q = qProd.trim();
    if (q.length < 2) return;
    const t = setTimeout(async () => {
      setBuscandoProd(true);
      setResProd(await buscarProductosVenta(slug, cliente?.id ?? null, q));
      setBuscandoProd(false);
    }, 300);
    return () => clearTimeout(t);
  }, [qProd, slug, cliente?.id]);

  async function elegirCliente(c: ClienteVenta | null) {
    setCliente(c);
    setQCliente("");
    setResClientes([]);
    if (!c) {
      setPayment("contado");
      setLineas((ls) => ls.map((l) => ({ ...l, guardarFijo: false })));
    }
    // recalcular precios de los renglones para el cliente nuevo
    if (lineas.length) {
      const precios = await preciosParaCliente(
        slug,
        c?.id ?? null,
        lineas.map((l) => l.variantId),
      );
      setLineas((ls) =>
        ls.map((l) =>
          precios[l.variantId]
            ? { ...l, precioLista: precios[l.variantId].precio, origen: precios[l.variantId].origen }
            : l,
        ),
      );
    }
  }

  function agregar(p: ProductoVenta) {
    setLineas((ls) => {
      const ya = ls.find((l) => l.variantId === p.variantId && !l.editandoPrecio);
      if (ya) {
        return ls.map((l) =>
          l.key === ya.key
            ? { ...l, cantidad: String((parsearNumero(l.cantidad) ?? 0) + 1) }
            : l,
        );
      }
      return [
        ...ls,
        {
          key: nuevaKey(),
          variantId: p.variantId,
          producto: p.producto,
          presentacion: p.presentacion,
          sku: p.sku,
          stock: p.stock,
          cantidad: "1",
          precioLista: p.precio,
          origen: p.origen,
          costo: p.costo,
          editandoPrecio: p.precio == null && puedeCambiarPrecio,
          precioManual: "",
          motivo: "",
          guardarFijo: false,
        },
      ];
    });
    setQProd("");
    setResProd([]);
  }

  const set = (key: string, cambios: Partial<Linea>) =>
    setLineas((ls) => ls.map((l) => (l.key === key ? { ...l, ...cambios } : l)));

  const total = useMemo(
    () =>
      lineas.reduce((acc, l) => {
        const p = precioDe(l);
        const q = parsearNumero(l.cantidad) ?? 0;
        return acc + (p != null ? Math.round(p * q * 100) / 100 : 0);
      }, 0),
    [lineas],
  );

  const superaLimite =
    payment === "cuenta_corriente" &&
    cliente != null &&
    cliente.creditLimit > 0 &&
    cliente.balance + total > cliente.creditLimit;

  function validar(): string | null {
    if (lineas.length === 0) return "Agregá al menos un producto";
    for (const l of lineas) {
      const q = parsearNumero(l.cantidad);
      if (q == null || q <= 0) return `${l.producto}: cantidad inválida`;
      if (precioDe(l) == null) return `${l.producto}: no tiene precio`;
      if (l.editandoPrecio && l.motivo.trim().length < 3)
        return `${l.producto}: escribí el motivo del cambio de precio`;
    }
    if (payment === "cuenta_corriente" && !cliente)
      return "Una venta a cuenta corriente necesita un cliente";
    return null;
  }

  /** Chequeos previos; devuelve false si el usuario no puede/quiere seguir. */
  function prechequear(confirmar: boolean): boolean {
    const err = validar();
    if (err) {
      notificar({ ok: false, message: err });
      return false;
    }

    const bajoCosto = lineas.filter((l) => {
      const p = precioDe(l);
      return l.costo != null && p != null && p < l.costo;
    });
    if (
      bajoCosto.length &&
      !window.confirm(
        `Estos renglones quedan POR DEBAJO DEL COSTO:\n\n${bajoCosto.map((l) => `${l.producto} ${l.presentacion}`).join("\n")}\n\n¿Seguir igual?`,
      )
    ) {
      return false;
    }
    if (confirmar) {
      const sinStock = lineas.filter((l) => (parsearNumero(l.cantidad) ?? 0) > l.stock);
      if (sinStock.length) {
        notificar({
          ok: false,
          message: `No hay stock suficiente de: ${sinStock.map((l) => l.producto).join(", ")}. Podés guardarlo como pedido nuevo y confirmarlo cuando entre mercadería.`,
        });
        return false;
      }
    }
    return true;
  }

  async function enviar(confirmar: CobroConfirmacion | null) {
    setGuardando(true);
    const r = await guardarPedido(
      slug,
      pedido?.id ?? null,
      {
        customerId: cliente?.id ?? null,
        payment,
        dueDate: payment === "cuenta_corriente" ? dueDate : null,
        notes: notes.trim() || null,
        items: lineas.map((l) => ({
          variantId: l.variantId,
          quantity: parsearNumero(l.cantidad) ?? 0,
          unitPrice: l.editandoPrecio ? parsearNumero(l.precioManual) : null,
          reason: l.editandoPrecio ? l.motivo.trim() : null,
          saveSpecial: l.editandoPrecio && l.guardarFijo && !!cliente,
        })),
      },
      confirmar,
    );
    setGuardando(false);
    notificar(r);
    const id = (r.data as { id?: string } | undefined)?.id;
    if (id) router.push(`/panel/${slug}/ventas/${id}`);
  }

  return (
    <div className="space-y-5 pb-24">
      {pedido?.contacto && (
        <Card>
          <CardBody className="text-sm">
            <p className="font-medium text-texto">
              Pedido recibido por {pedido.contacto.canal}
            </p>
            <p className="mt-1 text-texto-sec">
              {[pedido.contacto.nombre, pedido.contacto.telefono, pedido.contacto.email, pedido.contacto.direccion]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <FieldHint>
              Llegó con el precio general. Si es un cliente cargado, elegilo abajo y los
              precios se recalculan con su nivel.
            </FieldHint>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Cliente y pago</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {cliente ? (
            <div className="flex items-start justify-between gap-3 rounded-comp-sm border border-linea px-3 py-2">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-texto">{cliente.name}</p>
                <p className="text-xs text-texto-sec">
                  {cliente.doc ? `${cliente.doc} · ` : ""}
                  Saldo {formatearMoneda(cliente.balance)}
                  {cliente.creditLimit > 0 && <> · Límite {formatearMoneda(cliente.creditLimit)}</>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => elegirCliente(null)}
                className="shrink-0 rounded-comp-sm p-1 text-texto-sec hover:bg-superficie-sec"
                aria-label="Quitar cliente"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div>
              <Label>Cliente</Label>
              <div className="relative">
                <UserRound
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-tenue"
                />
                <Input
                  value={qCliente}
                  onChange={(e) => setQCliente(e.target.value)}
                  placeholder="Buscá por nombre, documento, email o teléfono…"
                  className="pl-8"
                />
              </div>
              {qCliente.trim().length >= 2 && resClientes.length > 0 && (
                <ul className="mt-1 max-h-56 divide-y divide-linea overflow-y-auto rounded-comp-sm border border-linea bg-superficie">
                  {resClientes.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => elegirCliente(c)}
                        className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-superficie-sec"
                      >
                        <span className="truncate text-texto">{c.name}</span>
                        <span className="shrink-0 text-xs text-texto-tenue">{c.doc ?? ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <FieldHint>Sin cliente = consumidor final, solo de contado.</FieldHint>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Condición de pago</Label>
              <Select
                value={payment}
                onChange={(e) => setPayment(e.target.value as CondicionPago)}
              >
                {CONDICIONES_PAGO.map((c) => (
                  <option key={c} value={c} disabled={c === "cuenta_corriente" && !cliente}>
                    {ETIQUETA_CONDICION_PAGO[c]}
                  </option>
                ))}
              </Select>
            </div>
            {payment === "cuenta_corriente" && (
              <div>
                <Label>Vence</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                <FieldHint>Al confirmar se carga el total en su cuenta corriente.</FieldHint>
              </div>
            )}
          </div>
          {superaLimite && (
            <p className="rounded-comp-sm bg-alerta-suave px-3 py-2 text-sm text-alerta">
              Con esta venta el cliente supera su límite de cuenta corriente.
              {esAdmin ? " Como administrador podés confirmarla igual." : " Solo un administrador puede confirmarla."}
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-tenue"
              />
              <Input
                value={qProd}
                onChange={(e) => setQProd(e.target.value)}
                placeholder="Agregar producto: nombre, marca, SKU o código de barras…"
                className="pl-8"
              />
            </div>
            {buscandoProd && <FieldHint>Buscando…</FieldHint>}
            {qProd.trim().length >= 2 && resProd.length > 0 && (
              <ul className="mt-1 max-h-64 divide-y divide-linea overflow-y-auto rounded-comp-sm border border-linea bg-superficie">
                {resProd.map((p) => (
                  <li key={p.variantId}>
                    <button
                      type="button"
                      onClick={() => agregar(p)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-superficie-sec"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-texto">{p.producto}</span>
                        <span className="block truncate text-xs text-texto-tenue">
                          {p.presentacion} · {p.sku} · stock {formatearNumero(p.stock)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right tabular-nums">
                        <span className="block text-texto">
                          {p.precio != null ? formatearMoneda(p.precio) : "sin precio"}
                        </span>
                        {p.origen === "especial" && (
                          <span className="block text-[11px] text-primario">especial</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!buscandoProd && qProd.trim().length >= 2 && resProd.length === 0 && (
              <FieldHint>No se encontraron productos activos.</FieldHint>
            )}
          </div>

          {lineas.length === 0 ? (
            <p className="text-sm text-texto-tenue">Todavía no agregaste productos.</p>
          ) : (
            <ul className="divide-y divide-linea">
              {lineas.map((l) => {
                const q = parsearNumero(l.cantidad) ?? 0;
                const p = precioDe(l);
                const sinStock = q > l.stock;
                const bajoCosto = l.costo != null && p != null && p < l.costo;
                return (
                  <li key={l.key} className="space-y-2 py-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-texto">{l.producto}</p>
                        <p className="truncate text-xs text-texto-tenue">
                          {l.presentacion} · {l.sku} · stock {formatearNumero(l.stock)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLineas((ls) => ls.filter((x) => x.key !== l.key))}
                        className="rounded-comp-sm p-1 text-texto-sec hover:bg-error-suave hover:text-error"
                        aria-label="Quitar renglón"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="w-24">
                        <span className="mb-0.5 block text-xs text-texto-sec">Cantidad</span>
                        <Input
                          inputMode="decimal"
                          value={l.cantidad}
                          onChange={(e) => set(l.key, { cantidad: e.target.value })}
                          className={cn(sinStock && "border-alerta")}
                        />
                      </div>
                      <div className="min-w-32 flex-1">
                        <span className="mb-0.5 block text-xs text-texto-sec">Precio unitario</span>
                        {l.editandoPrecio ? (
                          <Input
                            inputMode="decimal"
                            value={l.precioManual}
                            onChange={(e) => set(l.key, { precioManual: e.target.value })}
                            placeholder={l.precioLista != null ? String(l.precioLista) : "0,00"}
                            className={cn(bajoCosto && "border-error")}
                          />
                        ) : (
                          <div className="flex h-10 items-center gap-2 text-sm">
                            <span className="tabular-nums text-texto">
                              {l.precioLista != null ? formatearMoneda(l.precioLista) : "sin precio"}
                            </span>
                            {l.origen === "especial" && <Badge tono="primario">Especial</Badge>}
                            {puedeCambiarPrecio && (
                              <button
                                type="button"
                                onClick={() =>
                                  set(l.key, {
                                    editandoPrecio: true,
                                    precioManual: l.precioLista != null ? String(l.precioLista) : "",
                                  })
                                }
                                className="inline-flex items-center gap-1 text-xs text-primario hover:underline"
                              >
                                <Pencil size={12} />
                                Cambiar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="w-32 text-right">
                        <span className="mb-0.5 block text-xs text-texto-sec">Subtotal</span>
                        <p className="flex h-10 items-center justify-end text-sm font-medium tabular-nums text-texto">
                          {p != null ? formatearMoneda(Math.round(p * q * 100) / 100) : "—"}
                        </p>
                      </div>
                    </div>

                    {l.editandoPrecio && (
                      <div className="space-y-2 rounded-comp-sm bg-superficie-sec p-2.5">
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="min-w-48 flex-1">
                            <span className="mb-0.5 block text-xs text-texto-sec">
                              Motivo del cambio (obligatorio)
                            </span>
                            <Input
                              value={l.motivo}
                              maxLength={200}
                              onChange={(e) => set(l.key, { motivo: e.target.value })}
                              placeholder="Ej: acuerdo por volumen, precio pactado…"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              set(l.key, { editandoPrecio: false, precioManual: "", motivo: "", guardarFijo: false })
                            }
                            className="h-10 text-xs text-texto-sec hover:text-texto"
                          >
                            Volver al precio de lista
                          </button>
                        </div>
                        <label
                          className={cn(
                            "flex items-start gap-2 text-sm",
                            cliente ? "text-texto" : "text-texto-tenue",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={l.guardarFijo}
                            disabled={!cliente}
                            onChange={(e) => set(l.key, { guardarFijo: e.target.checked })}
                            className="mt-0.5"
                          />
                          <span>
                            Dejar este precio fijo para {cliente ? cliente.name : "el cliente"}
                            <span className="block text-xs text-texto-sec">
                              Si no lo marcás, el precio vale solo para esta venta.
                            </span>
                          </span>
                        </label>
                      </div>
                    )}

                    {(sinStock || bajoCosto) && (
                      <p className="text-xs">
                        {sinStock && (
                          <span className="text-alerta">
                            No alcanza el stock (hay {formatearNumero(l.stock)}).{" "}
                          </span>
                        )}
                        {bajoCosto && (
                          <span className="text-error">
                            Por debajo del costo{esAdmin ? "" : ": solo un administrador puede venderlo así"}.
                          </span>
                        )}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div>
            <Label>Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Entrega, horario, observaciones…"
            />
          </div>
        </CardBody>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-linea bg-superficie/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-end gap-2">
          <p className="mr-auto text-sm text-texto-sec">
            Total{" "}
            <span className="text-lg font-semibold tabular-nums text-texto">
              {formatearMoneda(total)}
            </span>
          </p>
          <Button
            variante="secundario"
            onClick={() => prechequear(false) && enviar(null)}
            disabled={guardando}
          >
            Guardar como Nuevo
          </Button>
          <Button
            onClick={() => {
              if (!prechequear(true)) return;
              if (payment === "contado" && total > 0) setCobrando(true);
              else enviar({ pagos: null, cobrarAlEntregar: false });
            }}
            disabled={guardando}
          >
            {guardando ? "Guardando…" : "Confirmar venta"}
          </Button>
        </div>
      </div>
      {cobrando && (
        <ModalCobroVenta
          abierto
          total={total}
          onCerrar={() => setCobrando(false)}
          onConfirmar={async (cobro) => {
            setCobrando(false);
            await enviar(cobro);
          }}
        />
      )}
    </div>
  );
}
