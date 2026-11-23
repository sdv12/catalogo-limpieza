import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { resolverCatalogo, puedeEditar, esAdminCatalogo } from "@/lib/dal";
import { cargarPedido } from "@/lib/ventas-data";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { OrderActions } from "@/components/ventas/OrderActions";
import { formatearFecha, formatearFechaHora, formatearMoneda, formatearNumero } from "@/lib/format";
import {
  ETIQUETA_CANAL,
  ETIQUETA_CONDICION_PAGO,
  ETIQUETA_ESTADO_PEDIDO,
  ETIQUETA_ORIGEN_PRECIO,
  TONO_ESTADO_PEDIDO,
} from "@/lib/ventas";

export const metadata = { title: "Pedido — Catálogo" };

export default async function PedidoPage({
  params,
}: {
  params: Promise<{ catalogo: string; id: string }>;
}) {
  const { catalogo: slug, id } = await params;
  const catalogo = await resolverCatalogo(slug);
  const p = await cargarPedido(catalogo, id);
  if (!p) notFound();

  const sinStock =
    p.status === "nuevo" ? p.items.filter((i) => i.cantidad > i.stockActual) : [];
  const contacto = [p.contacto.nombre, p.contacto.telefono, p.contacto.email, p.contacto.direccion]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        href={`/panel/${slug}/ventas`}
        className="inline-flex items-center gap-1 text-sm text-texto-sec hover:text-texto"
      >
        <ChevronLeft size={16} />
        Ventas
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-texto">Pedido #{p.number}</h1>
            <Badge tono={TONO_ESTADO_PEDIDO[p.status]}>{ETIQUETA_ESTADO_PEDIDO[p.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-texto-sec">
            {formatearFechaHora(p.createdAt)} · {p.channelName ?? ETIQUETA_CANAL[p.channel]}
            {p.externalRef && <> · ref. {p.externalRef}</>}
          </p>
        </div>
        <OrderActions
          slug={slug}
          id={p.id}
          estado={p.status}
          puedeEditar={puedeEditar(catalogo)}
          esAdmin={esAdminCatalogo(catalogo)}
          contado={p.payment === "contado"}
          total={p.total}
          faltaCobrar={Math.max(0, Math.round((p.total - p.pagado) * 100) / 100)}
        />
      </div>

      {p.status === "cancelado" && (
        <p className="rounded-comp-sm bg-superficie-sec px-3 py-2 text-sm text-texto-sec">
          Cancelado el {formatearFechaHora(p.cancelledAt)}. Motivo: {p.cancelReason}
        </p>
      )}
      {sinStock.length > 0 && (
        <p className="rounded-comp-sm bg-alerta-suave px-3 py-2 text-sm text-alerta">
          No alcanza el stock para confirmar:{" "}
          {sinStock.map((i) => `${i.producto} ${i.presentacion} (hay ${formatearNumero(i.stockActual)})`).join(", ")}.
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
          </CardHeader>
          <CardBody className="space-y-1 text-sm">
            {p.cliente ? (
              <>
                <Link
                  href={`/panel/${slug}/clientes/${p.cliente.id}`}
                  className="font-medium text-primario hover:underline"
                >
                  {p.cliente.name}
                </Link>
                {p.cliente.doc && <p className="text-texto-sec">{p.cliente.doc}</p>}
                <p className="text-texto-sec">Saldo actual: {formatearMoneda(p.cliente.balance)}</p>
              </>
            ) : (
              <p className="text-texto">Consumidor final</p>
            )}
            {contacto && <p className="text-texto-sec">Contacto: {contacto}</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pago y entrega</CardTitle>
          </CardHeader>
          <CardBody className="space-y-1 text-sm text-texto-sec">
            <p>
              <span className="text-texto">{ETIQUETA_CONDICION_PAGO[p.payment]}</span>
              {p.payment === "cuenta_corriente" && p.dueDate && <> · vence {formatearFecha(p.dueDate)}</>}
            </p>
            {p.payment === "contado" && p.status !== "nuevo" && p.status !== "cancelado" && (
              <p>
                {p.pagado >= p.total ? (
                  <span className="text-exito">Cobrado {formatearMoneda(p.pagado)}</span>
                ) : (
                  <span className="text-alerta">
                    Falta cobrar {formatearMoneda(p.total - p.pagado)}
                    {p.cobrarAlEntregar && " (contra entrega)"}
                  </span>
                )}
              </p>
            )}
            {p.recibos.map((r) => (
              <p key={r.id}>
                <a
                  href={`/imprimir/${slug}/recibo/${r.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primario hover:underline"
                >
                  Recibo N° {r.number}
                </a>{" "}
                · {formatearMoneda(r.total)}
                {r.status === "anulado" && <span className="text-error"> · anulado</span>}
              </p>
            ))}
            {p.confirmedAt && <p>Confirmado: {formatearFechaHora(p.confirmedAt)}</p>}
            {p.deliveredAt && <p>Entregado: {formatearFechaHora(p.deliveredAt)}</p>}
            {p.notes && <p className="whitespace-pre-wrap text-texto">{p.notes}</p>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="tabla-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-linea text-left text-[11px] uppercase tracking-wide text-texto-sec">
                  <th className="py-2 pr-2">Producto</th>
                  <th className="py-2 pr-2 text-right">Cant.</th>
                  <th className="py-2 pr-2 text-right">Precio</th>
                  <th className="py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {p.items.map((i) => (
                  <tr key={i.id} className="border-b border-linea align-top">
                    <td className="py-2 pr-2">
                      <span className="block text-texto">{i.producto}</span>
                      <span className="block text-xs text-texto-tenue">
                        {i.presentacion} · {i.sku}
                      </span>
                      {i.origen !== "lista" && (
                        <span className="mt-0.5 block text-xs text-primario">
                          {ETIQUETA_ORIGEN_PRECIO[i.origen]}
                          {i.origen === "manual" && i.precioLista != null && (
                            <> (lista {formatearMoneda(i.precioLista)})</>
                          )}
                          {i.motivo && <> · {i.motivo}</>}
                          {i.guardarFijo && <> · queda fijo para el cliente</>}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{formatearNumero(i.cantidad)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{formatearMoneda(i.precio)}</td>
                    <td className="py-2 text-right font-medium tabular-nums">{formatearMoneda(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-3 text-right text-sm text-texto-sec">
                    Total
                  </td>
                  <td className="pt-3 text-right text-lg font-semibold tabular-nums text-texto">
                    {formatearMoneda(p.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
