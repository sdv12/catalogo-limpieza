import Link from "next/link";
import { Plus, KeyRound } from "lucide-react";
import { resolverCatalogo, puedeEditar, esAdminCatalogo } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { sanitizarBusqueda, formatearMoneda, formatearFechaHora } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { BuscadorUrl, SelectUrl } from "@/components/common/FiltrosUrl";
import { cn } from "@/lib/cn";
import {
  CANALES_PEDIDO,
  ESTADOS_PEDIDO,
  ETIQUETA_CANAL,
  ETIQUETA_CONDICION_PAGO,
  ETIQUETA_ESTADO_PEDIDO,
  TONO_ESTADO_PEDIDO,
  type CanalPedido,
  type CondicionPago,
  type EstadoPedido,
} from "@/lib/ventas";

export const metadata = { title: "Ventas — Catálogo" };

const POR_PAGINA = 30;
type SP = Record<string, string | undefined>;

/** Pestañas de la bandeja: "activos" = todo lo que todavía requiere trabajo. */
const PESTANAS: { id: string; label: string; estados: EstadoPedido[] }[] = [
  { id: "activos", label: "En curso", estados: ["nuevo", "confirmado", "preparando", "en_reparto"] },
  { id: "nuevo", label: "Nuevos", estados: ["nuevo"] },
  { id: "confirmado", label: "Confirmados", estados: ["confirmado"] },
  { id: "preparando", label: "Preparando", estados: ["preparando"] },
  { id: "en_reparto", label: "En reparto", estados: ["en_reparto"] },
  { id: "entregado", label: "Entregados", estados: ["entregado"] },
  { id: "cancelado", label: "Cancelados", estados: ["cancelado"] },
  { id: "todos", label: "Todos", estados: [...ESTADOS_PEDIDO] },
];

export default async function VentasPage({
  params,
  searchParams,
}: {
  params: Promise<{ catalogo: string }>;
  searchParams: Promise<SP>;
}) {
  const { catalogo: slug } = await params;
  const sp = await searchParams;
  const catalogo = await resolverCatalogo(slug);
  const supabase = await createClient();

  const pestana = PESTANAS.find((p) => p.id === sp.estado) ?? PESTANAS[0];
  const pagina = Math.max(1, Number(sp.page) || 1);
  const desde = (pagina - 1) * POR_PAGINA;

  let query = supabase
    .from("orders")
    .select(
      "id, number, status, channel, channel_name, payment_terms, total, created_at, contact_name, customer:customers(name)",
      { count: "exact" },
    )
    .eq("catalog_id", catalogo.id)
    .in("status", pestana.estados);
  if (sp.canal && (CANALES_PEDIDO as readonly string[]).includes(sp.canal)) {
    query = query.eq("channel", sp.canal);
  }
  if (sp.q?.trim()) {
    const t = sanitizarBusqueda(sp.q);
    const n = Number(t.replace(/^#/, ""));
    if (Number.isInteger(n) && n > 0) {
      query = query.eq("number", n);
    } else {
      const { data: clientes } = await supabase
        .from("customers")
        .select("id")
        .eq("catalog_id", catalogo.id)
        .or(`name.ilike.%${t}%,doc_number.ilike.%${t}%`)
        .limit(50);
      const ids = (clientes ?? []).map((c) => c.id);
      const filtros = [`contact_name.ilike.%${t}%`, `contact_phone.ilike.%${t}%`];
      if (ids.length) filtros.push(`customer_id.in.(${ids.join(",")})`);
      query = query.or(filtros.join(","));
    }
  }

  const [{ data: filas, count }, conteos] = await Promise.all([
    query.order("created_at", { ascending: false }).range(desde, desde + POR_PAGINA - 1),
    Promise.all(
      (["nuevo", "confirmado", "preparando", "en_reparto"] as const).map((e) =>
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("catalog_id", catalogo.id)
          .eq("status", e)
          .then((r) => [e, r.count ?? 0] as const),
      ),
    ),
  ]);
  const conteo = Object.fromEntries(conteos) as Record<string, number>;
  conteo.activos =
    (conteo.nuevo ?? 0) + (conteo.confirmado ?? 0) + (conteo.preparando ?? 0) + (conteo.en_reparto ?? 0);

  const total = count ?? 0;
  const hacerHref = (cambios: SP) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...cambios })) if (v) q.set(k, v);
    const s = q.toString();
    return `/panel/${slug}/ventas${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-texto">Ventas</h1>
          <p className="mt-1 text-sm text-texto-sec">
            Pedidos del panel, las tiendas online y WhatsApp, en un solo lugar.
          </p>
        </div>
        <div className="flex gap-2">
          {esAdminCatalogo(catalogo) && (
            <Link href={`/panel/${slug}/ventas/canales`}>
              <Button variante="secundario">
                <KeyRound size={16} />
                Canales
              </Button>
            </Link>
          )}
          {puedeEditar(catalogo) && (
            <Link href={`/panel/${slug}/ventas/nueva`}>
              <Button>
                <Plus size={16} />
                Nueva venta
              </Button>
            </Link>
          )}
        </div>
      </div>

      <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Estados">
        {PESTANAS.map((p) => {
          const activa = p.id === pestana.id;
          const n = conteo[p.id];
          return (
            <Link
              key={p.id}
              href={hacerHref({ estado: p.id === "activos" ? undefined : p.id, page: undefined })}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
                activa
                  ? "border-primario bg-primario-suave text-primario-fuerte"
                  : "border-linea text-texto-sec hover:bg-superficie-sec",
              )}
            >
              {p.label}
              {n ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    p.id === "nuevo" ? "bg-error text-white" : "bg-superficie-sec text-texto-sec",
                  )}
                >
                  {n}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2 sm:flex-row">
        <BuscadorUrl placeholder="Buscar por N° de pedido, cliente o contacto…" className="flex-1" />
        <SelectUrl param="canal" ariaLabel="Filtrar por canal" className="sm:w-44">
          <option value="">Todos los canales</option>
          {CANALES_PEDIDO.map((c) => (
            <option key={c} value={c}>
              {ETIQUETA_CANAL[c]}
            </option>
          ))}
        </SelectUrl>
      </div>

      {(filas?.length ?? 0) === 0 ? (
        <EmptyState
          titulo="Sin pedidos"
          descripcion="No hay pedidos para este filtro."
        />
      ) : (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>N°</Th>
                  <Th>Fecha</Th>
                  <Th>Cliente</Th>
                  <Th>Canal</Th>
                  <Th>Pago</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {(filas ?? []).map((f) => {
                  const href = `/panel/${slug}/ventas/${f.id}`;
                  return (
                    <tr key={f.id} className="hover:bg-superficie-sec">
                      <Td className="font-medium tabular-nums">
                        <Link href={href} className="text-primario hover:underline">
                          #{f.number}
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap text-texto-sec">
                        {formatearFechaHora(f.created_at)}
                      </Td>
                      <Td>
                        <Link href={href} className="text-texto hover:underline">
                          {f.customer?.name ?? f.contact_name ?? "Consumidor final"}
                        </Link>
                      </Td>
                      <Td className="text-texto-sec">
                        {f.channel_name ?? ETIQUETA_CANAL[f.channel as CanalPedido]}
                      </Td>
                      <Td className="text-texto-sec">
                        {ETIQUETA_CONDICION_PAGO[f.payment_terms as CondicionPago]}
                      </Td>
                      <Td>
                        <Badge tono={TONO_ESTADO_PEDIDO[f.status as EstadoPedido]}>
                          {ETIQUETA_ESTADO_PEDIDO[f.status as EstadoPedido]}
                        </Badge>
                      </Td>
                      <Td className="text-right font-medium tabular-nums">
                        {formatearMoneda(Number(f.total))}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
          <Pagination
            total={total}
            porPagina={POR_PAGINA}
            paginaActual={pagina}
            hacerHref={(p) => hacerHref({ page: String(p) })}
          />
        </>
      )}
    </div>
  );
}
