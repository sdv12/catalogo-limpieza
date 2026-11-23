import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatearFechaHora, formatearMoneda } from "@/lib/format";
import { ETIQUETA_METODO_PAGO, METODOS_PAGO, type MetodoPago } from "@/lib/ventas";
import type { SesionCaja } from "@/lib/caja-data";
import { AnularReciboBoton } from "@/components/caja/CajaControles";

export function CajaDetalle({
  slug,
  sesion,
  puedeAnular,
}: {
  slug: string;
  sesion: SesionCaja;
  puedeAnular: boolean;
}) {
  const s = sesion;
  const otrosMedios = METODOS_PAGO.filter((m) => m !== "efectivo" && s.porMetodo[m] > 0);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs text-texto-sec">Efectivo esperado en caja</p>
            <p className="text-xl font-semibold tabular-nums text-texto">{formatearMoneda(s.esperado)}</p>
            <p className="mt-1 text-xs text-texto-tenue">
              Inicial {formatearMoneda(s.inicial)} + cobrado {formatearMoneda(s.porMetodo.efectivo)}
              {s.ingresos > 0 && <> + ingresos {formatearMoneda(s.ingresos)}</>}
              {s.egresos > 0 && <> − egresos {formatearMoneda(s.egresos)}</>}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-texto-sec">Otros medios cobrados</p>
            {otrosMedios.length === 0 ? (
              <p className="text-sm text-texto-tenue">Nada todavía</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-sm">
                {otrosMedios.map((m) => (
                  <li key={m} className="flex justify-between gap-2">
                    <span className="text-texto-sec">{ETIQUETA_METODO_PAGO[m]}</span>
                    <span className="tabular-nums text-texto">{formatearMoneda(s.porMetodo[m])}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-texto-sec">{s.status === "abierta" ? "Abierta" : "Cerrada"}</p>
            <p className="text-sm text-texto">{formatearFechaHora(s.openedAt)}</p>
            {s.closedAt && <p className="text-sm text-texto">→ {formatearFechaHora(s.closedAt)}</p>}
            {s.diferencia != null && (
              <p
                className={cn(
                  "mt-1 text-sm font-medium",
                  s.diferencia === 0 ? "text-exito" : "text-alerta",
                )}
              >
                {s.diferencia === 0
                  ? "Arqueo sin diferencia"
                  : `${s.diferencia > 0 ? "Sobrante" : "Faltante"} ${formatearMoneda(Math.abs(s.diferencia))}`}
              </p>
            )}
            {s.nota && <p className="mt-1 text-xs text-texto-sec">{s.nota}</p>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recibos ({s.recibos.length})</CardTitle>
        </CardHeader>
        <CardBody>
          {s.recibos.length === 0 ? (
            <p className="text-sm text-texto-tenue">Sin cobros en esta caja.</p>
          ) : (
            <div className="tabla-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-linea text-left text-[11px] uppercase tracking-wide text-texto-sec">
                    <th className="py-2 pr-2">N°</th>
                    <th className="py-2 pr-2">Hora</th>
                    <th className="py-2 pr-2">Cliente / pedido</th>
                    <th className="py-2 pr-2">Medio</th>
                    <th className="py-2 pr-2 text-right">Total</th>
                    {puedeAnular && <th className="w-8 py-2"></th>}
                  </tr>
                </thead>
                <tbody>
                  {s.recibos.map((r) => (
                    <tr key={r.id} className={cn("border-b border-linea", r.status === "anulado" && "opacity-60")}>
                      <td className="py-1.5 pr-2">
                        <a
                          href={`/imprimir/${slug}/recibo/${r.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tabular-nums text-primario hover:underline"
                        >
                          {r.number}
                        </a>
                      </td>
                      <td className="py-1.5 pr-2 whitespace-nowrap text-texto-sec">
                        {formatearFechaHora(r.createdAt)}
                      </td>
                      <td className="py-1.5 pr-2">
                        <span className="text-texto">{r.cliente ?? "Consumidor final"}</span>
                        {r.pedido && (
                          <Link
                            href={`/panel/${slug}/ventas/${r.pedido.id}`}
                            className="ml-1 text-xs text-primario hover:underline"
                          >
                            pedido #{r.pedido.number}
                          </Link>
                        )}
                        {r.status === "anulado" && (
                          <span className="block text-xs text-error">Anulado: {r.voidReason}</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 text-texto-sec">
                        {r.metodos
                          .split(",")
                          .map((m) => ETIQUETA_METODO_PAGO[m as MetodoPago] ?? m)
                          .join(" + ")}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-medium tabular-nums">
                        {formatearMoneda(r.total)}
                      </td>
                      {puedeAnular && (
                        <td className="py-1.5">
                          {r.status === "valido" && (
                            <AnularReciboBoton slug={slug} reciboId={r.id} numero={r.number} />
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {s.movimientos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ingresos y egresos de efectivo</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-linea text-sm">
              {s.movimientos.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2">
                  <Badge tono={m.kind === "ingreso" ? "exito" : "alerta"}>
                    {m.kind === "ingreso" ? "Ingreso" : "Egreso"}
                  </Badge>
                  <span className="min-w-0 flex-1 text-texto-sec">{m.reason}</span>
                  <span className="text-xs text-texto-tenue">{formatearFechaHora(m.createdAt)}</span>
                  <span className="tabular-nums text-texto">
                    {m.kind === "egreso" ? "−" : "+"}
                    {formatearMoneda(m.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
