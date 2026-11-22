import { notFound } from "next/navigation";
import { resolverCatalogo } from "@/lib/dal";
import { cargarPedido } from "@/lib/ventas-data";
import { formatearFecha, formatearMoneda, formatearNumero } from "@/lib/format";
import { ETIQUETA_CONDICION_PAGO, ETIQUETA_ESTADO_PEDIDO } from "@/lib/ventas";
import { BarraPedido } from "./BarraPedido";

export const metadata = { title: "Pedido" };

export default async function PedidoImprimible({
  params,
}: {
  params: Promise<{ catalogo: string; id: string }>;
}) {
  const { catalogo: slug, id } = await params;
  const catalogo = await resolverCatalogo(slug);
  const p = await cargarPedido(catalogo, id);
  if (!p) notFound();

  const destinatario = p.cliente?.name ?? p.contacto.nombre ?? "Consumidor final";
  const direccion = p.contacto.direccion ?? p.cliente?.address ?? null;
  const telefono = p.contacto.telefono ?? p.cliente?.phone ?? null;

  return (
    <>
      <BarraPedido volver={`/panel/${slug}/ventas/${id}`} titulo={`Pedido #${p.number}`} />
      <div className="mx-auto max-w-[210mm] p-3 sm:p-6 print:p-0">
        <div className="papel p-5 sm:p-8 print:p-0">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e6e8ec] pb-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-[#111]">{catalogo.name}</h1>
              <p className="mt-0.5 text-xs text-[#8a929c]">
                Comprobante de pedido · no válido como factura
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="text-base font-semibold text-[#111]">Pedido #{p.number}</p>
              <p className="text-[#5c6570]">{formatearFecha(p.createdAt)}</p>
              <p className="text-xs text-[#8a929c]">{ETIQUETA_ESTADO_PEDIDO[p.status]}</p>
            </div>
          </header>

          <section className="grid gap-4 border-b border-[#e6e8ec] py-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[#8a929c]">Cliente</p>
              <p className="font-medium text-[#111]">{destinatario}</p>
              {p.cliente?.doc && <p className="text-[#5c6570]">{p.cliente.doc}</p>}
              {telefono && <p className="text-[#5c6570]">{telefono}</p>}
              {direccion && <p className="text-[#5c6570]">{direccion}</p>}
            </div>
            <div className="sm:text-right">
              <p className="text-[11px] uppercase tracking-wide text-[#8a929c]">Pago</p>
              <p className="text-[#111]">{ETIQUETA_CONDICION_PAGO[p.payment]}</p>
              {p.payment === "cuenta_corriente" && p.dueDate && (
                <p className="text-[#5c6570]">Vence {formatearFecha(p.dueDate)}</p>
              )}
            </div>
          </section>

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-[#e6e8ec] text-left text-[11px] uppercase tracking-wide text-[#8a929c]">
                <th className="py-2 pr-2">Producto</th>
                <th className="py-2 pr-2 text-right">Cant.</th>
                <th className="py-2 pr-2 text-right">Precio</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {p.items.map((i) => (
                <tr key={i.id} className="border-b border-[#f0f1f3]">
                  <td className="py-1.5 pr-2">
                    <span className="text-[#111]">{i.producto}</span>{" "}
                    <span className="text-[#8a929c]">{i.presentacion}</span>
                    <span className="block text-[11px] text-[#8a929c]">{i.sku}</span>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{formatearNumero(i.cantidad)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{formatearMoneda(i.precio)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatearMoneda(i.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-3 text-right text-[#5c6570]">
                  Total
                </td>
                <td className="pt-3 text-right text-base font-semibold tabular-nums text-[#111]">
                  {formatearMoneda(p.total)}
                </td>
              </tr>
            </tfoot>
          </table>

          {p.notes && (
            <p className="mt-4 whitespace-pre-wrap text-sm text-[#5c6570]">
              <span className="text-[11px] uppercase tracking-wide text-[#8a929c]">Notas</span>
              <br />
              {p.notes}
            </p>
          )}

          <div className="mt-12 grid grid-cols-2 gap-10 text-xs text-[#8a929c]">
            <div className="border-t border-dotted border-[#b8bdc5] pt-1">Recibí conforme (firma)</div>
            <div className="border-t border-dotted border-[#b8bdc5] pt-1">Aclaración y DNI</div>
          </div>
        </div>
      </div>
    </>
  );
}
