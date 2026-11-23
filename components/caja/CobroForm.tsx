"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserRound, X, Printer, CheckCircle2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldHint } from "@/components/ui/Field";
import { notificar } from "@/lib/ui";
import { formatearMoneda } from "@/lib/format";
import { MediosPago, nuevaLineaPago, resolverPago, type LineaPagoEditable } from "@/components/caja/MediosPago";
import { registrarCobro } from "@/app/panel/[catalogo]/caja/actions";
import { buscarClientesVenta } from "@/app/panel/[catalogo]/ventas/actions";

type Cliente = { id: string; name: string; doc: string | null; balance: number };

export function CobroForm({
  slug,
  cliente: clienteInicial,
  pedido,
}: {
  slug: string;
  cliente: Cliente | null;
  /** Cobro de un pedido de contado pendiente. */
  pedido: { id: string; number: number; falta: number; cliente: string | null } | null;
}) {
  const [cliente, setCliente] = useState<Cliente | null>(clienteInicial);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Cliente[]>([]);
  const sugerido = pedido ? pedido.falta : cliente && cliente.balance > 0 ? cliente.balance : 0;
  const [lineas, setLineas] = useState<LineaPagoEditable[]>(() => [
    nuevaLineaPago("efectivo", sugerido > 0 ? String(sugerido) : ""),
  ]);
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [hecho, setHecho] = useState<string | null>(null);

  useEffect(() => {
    const t = q.trim();
    if (pedido || t.length < 2) return;
    const h = setTimeout(async () => setRes(await buscarClientesVenta(slug, t)), 300);
    return () => clearTimeout(h);
  }, [q, slug, pedido]);

  async function cobrar() {
    if (!pedido && !cliente) return notificar({ ok: false, message: "Elegí el cliente que paga" });
    const r = resolverPago(lineas, pedido ? pedido.falta : null);
    if (r.error) return notificar({ ok: false, message: r.error });
    setOcupado(true);
    const out = await registrarCobro(
      slug,
      { customerId: pedido ? null : cliente!.id, orderId: pedido?.id ?? null },
      r.lineas,
      nota,
    );
    setOcupado(false);
    if (notificar(out)) setHecho((out.data as { id: string }).id);
  }

  if (hecho) {
    return (
      <Card>
        <CardBody className="space-y-3 text-center">
          <CheckCircle2 size={32} className="mx-auto text-exito" />
          <p className="font-medium text-texto">Cobro registrado</p>
          <div className="flex flex-wrap justify-center gap-2">
            <a href={`/imprimir/${slug}/recibo/${hecho}`} target="_blank" rel="noopener noreferrer">
              <Button variante="secundario">
                <Printer size={15} />
                Imprimir recibo
              </Button>
            </a>
            <Link href={pedido ? `/panel/${slug}/ventas/${pedido.id}` : `/panel/${slug}/caja`}>
              <Button>{pedido ? "Volver al pedido" : "Volver a la caja"}</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        {pedido ? (
          <div className="text-sm">
            <p className="font-medium text-texto">
              Pedido #{pedido.number}
              {pedido.cliente && <> · {pedido.cliente}</>}
            </p>
            <p className="text-texto-sec">
              Falta cobrar <span className="font-semibold text-texto">{formatearMoneda(pedido.falta)}</span>
            </p>
          </div>
        ) : cliente ? (
          <div className="flex items-start justify-between gap-3 rounded-comp-sm border border-linea px-3 py-2">
            <div className="text-sm">
              <p className="font-medium text-texto">{cliente.name}</p>
              <p className="text-xs text-texto-sec">
                {cliente.doc ? `${cliente.doc} · ` : ""}
                {cliente.balance > 0 ? `Debe ${formatearMoneda(cliente.balance)}` : "Sin deuda"}
              </p>
            </div>
            {!clienteInicial && (
              <button
                type="button"
                onClick={() => setCliente(null)}
                className="rounded-comp-sm p-1 text-texto-sec hover:bg-superficie-sec"
                aria-label="Cambiar cliente"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ) : (
          <div>
            <Label>Cliente que paga</Label>
            <div className="relative">
              <UserRound
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-tenue"
              />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscá por nombre, documento, email o teléfono…"
                className="pl-8"
              />
            </div>
            {q.trim().length >= 2 && res.length > 0 && (
              <ul className="mt-1 max-h-56 divide-y divide-linea overflow-y-auto rounded-comp-sm border border-linea bg-superficie">
                {res.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCliente(c);
                        setQ("");
                        setRes([]);
                        if (c.balance > 0) setLineas([nuevaLineaPago("efectivo", String(c.balance))]);
                      }}
                      className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-superficie-sec"
                    >
                      <span className="truncate text-texto">{c.name}</span>
                      <span className="shrink-0 text-xs text-texto-tenue">
                        {c.balance > 0 ? `debe ${formatearMoneda(c.balance)}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div>
          <Label>¿Cómo paga?</Label>
          <MediosPago lineas={lineas} onChange={setLineas} total={pedido ? pedido.falta : null} />
          {!pedido && (
            <FieldHint>
              Se descuenta de su cuenta corriente. Puede pagar una parte o todo.
            </FieldHint>
          )}
        </div>

        <div>
          <Label>Nota (opcional)</Label>
          <Input value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />
        </div>

        <div className="flex justify-end">
          <Button onClick={cobrar} disabled={ocupado}>
            {ocupado ? "Registrando…" : "Registrar cobro"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
