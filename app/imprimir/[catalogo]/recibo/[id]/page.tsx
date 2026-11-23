import { notFound } from "next/navigation";
import { resolverCatalogo } from "@/lib/dal";
import { cargarRecibo } from "@/lib/recibos";
import { formatearFechaHora, formatearMoneda } from "@/lib/format";
import { ETIQUETA_METODO_PAGO } from "@/lib/ventas";
import { BarraPedido } from "../../pedido/[id]/BarraPedido";
import { ReenviarReciboBoton } from "@/components/caja/CajaControles";

export const metadata = { title: "Recibo" };

export default async function ReciboImprimible({
  params,
}: {
  params: Promise<{ catalogo: string; id: string }>;
}) {
  const { catalogo: slug, id } = await params;
  const catalogo = await resolverCatalogo(slug);
  const r = await cargarRecibo(catalogo, id);
  if (!r) notFound();

  return (
    <>
      <BarraPedido
        volver={r.pedido ? `/panel/${slug}/ventas/${r.pedido.id}` : r.cliente ? `/panel/${slug}/clientes/${r.cliente.id}` : `/panel/${slug}/caja`}
        titulo={`Recibo N° ${r.number}`}
      >
        {r.status === "valido" && r.cliente?.email && <ReenviarReciboBoton slug={slug} reciboId={r.id} />}
      </BarraPedido>
      <div className="mx-auto max-w-[210mm] p-3 sm:p-6 print:p-0">
        <div className="papel relative p-5 sm:p-8 print:p-0">
          {r.status === "anulado" && (
            <p className="mb-4 rounded border border-[#b91c1c] px-3 py-2 text-center text-sm font-semibold text-[#b91c1c]">
              RECIBO ANULADO — {r.voidReason}
            </p>
          )}
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e6e8ec] pb-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-[#111]">{catalogo.name}</h1>
              <p className="mt-0.5 text-xs text-[#8a929c]">Recibo de pago · no válido como factura</p>
            </div>
            <div className="text-right text-sm">
              <p className="text-base font-semibold text-[#111]">Recibo N° {r.number}</p>
              <p className="text-[#5c6570]">{formatearFechaHora(r.createdAt)}</p>
            </div>
          </header>

          <section className="border-b border-[#e6e8ec] py-4 text-sm">
            <p className="text-[11px] uppercase tracking-wide text-[#8a929c]">Recibimos de</p>
            <p className="font-medium text-[#111]">{r.cliente?.name ?? "Consumidor final"}</p>
            {r.cliente?.doc && <p className="text-[#5c6570]">{r.cliente.doc}</p>}
            {r.pedido && <p className="mt-1 text-[#5c6570]">En pago del pedido #{r.pedido.number}</p>}
            {!r.pedido && r.cliente && <p className="mt-1 text-[#5c6570]">A cuenta de su cuenta corriente</p>}
          </section>

          <table className="mt-4 w-full text-sm">
            <tbody>
              {r.lineas.map((l, i) => (
                <tr key={i} className="border-b border-[#f0f1f3]">
                  <td className="py-1.5 pr-2 text-[#111]">
                    {ETIQUETA_METODO_PAGO[l.method]}
                    {l.reference && <span className="text-[#8a929c]"> · op. {l.reference}</span>}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{formatearMoneda(l.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-3 text-right text-[#5c6570]">Total recibido</td>
                <td className="pt-3 text-right text-base font-semibold tabular-nums text-[#111]">
                  {formatearMoneda(r.total)}
                </td>
              </tr>
            </tfoot>
          </table>

          {r.note && <p className="mt-4 text-sm text-[#5c6570]">{r.note}</p>}

          <div className="mt-12 grid grid-cols-2 gap-10 text-xs text-[#8a929c]">
            <div className="border-t border-dotted border-[#b8bdc5] pt-1">Firma</div>
            <div className="border-t border-dotted border-[#b8bdc5] pt-1">Aclaración</div>
          </div>
        </div>
      </div>
    </>
  );
}
