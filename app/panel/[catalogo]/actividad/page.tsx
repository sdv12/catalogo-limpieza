import { resolverCatalogo } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { mapasAuditoria } from "@/lib/catalog-data";
import { ACCIONES_AUDITORIA } from "@/lib/constants";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { AuditFilters } from "@/components/audit/AuditFilters";
import { AuditEntry } from "@/components/audit/AuditEntry";

export const metadata = { title: "Actividad — Catálogo" };

const POR_PAGINA = 30;
type SP = Record<string, string | undefined>;

export default async function ActividadPage({
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

  const pagina = Math.max(1, Number(sp.page) || 1);
  const desde = (pagina - 1) * POR_PAGINA;

  let query = supabase
    .from("audit_log")
    .select(
      "id, entity_type, action, changes, summary, actor_email, product_id, batch_id, created_at",
      { count: "exact" },
    )
    .eq("catalog_id", catalogo.id);

  if (sp.actor) query = query.eq("actor_id", sp.actor);
  if (sp.producto) query = query.eq("product_id", sp.producto);
  if (sp.lote) query = query.eq("batch_id", sp.lote);
  if (sp.accion && (ACCIONES_AUDITORIA as readonly string[]).includes(sp.accion))
    query = query.eq("action", sp.accion);
  if (sp.desde) query = query.gte("created_at", `${sp.desde}T00:00:00`);
  if (sp.hasta) query = query.lte("created_at", `${sp.hasta}T23:59:59`);

  const [{ data: entradas, count }, { data: actores }, { data: productos }, maps] =
    await Promise.all([
      query.order("created_at", { ascending: false }).range(desde, desde + POR_PAGINA - 1),
      supabase.rpc("catalog_actors", { p_catalog_id: catalogo.id }),
      supabase
        .from("products")
        .select("id, name")
        .eq("catalog_id", catalogo.id)
        .order("name")
        .limit(300),
      mapasAuditoria(supabase, catalogo.id),
    ]);

  const nombres = new Map((productos ?? []).map((p) => [p.id, p.name]));

  const hacerHref = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "page") q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return `/panel/${slug}/actividad${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-texto">Actividad</h1>
        <p className="mt-1 text-sm text-texto-sec">
          {count ?? 0} {count === 1 ? "cambio registrado" : "cambios registrados"}
        </p>
      </div>

      <AuditFilters
        actores={actores ?? []}
        productos={productos ?? []}
        valores={{
          actor: sp.actor ?? "",
          accion: sp.accion ?? "",
          producto: sp.producto ?? "",
          desde: sp.desde ?? "",
          hasta: sp.hasta ?? "",
        }}
      />

      {(entradas?.length ?? 0) === 0 ? (
        <EmptyState
          titulo="Sin actividad"
          descripcion="No hay cambios que coincidan con los filtros."
        />
      ) : (
        <>
          <Card>
            <CardBody className="py-0">
              {entradas!.map((e) => (
                <AuditEntry
                  key={e.id}
                  entrada={e}
                  slug={slug}
                  mostrarProducto
                  nombreProducto={e.product_id ? nombres.get(e.product_id) : null}
                  maps={maps}
                />
              ))}
            </CardBody>
          </Card>
          <Pagination
            total={count ?? 0}
            porPagina={POR_PAGINA}
            paginaActual={pagina}
            hacerHref={hacerHref}
          />
        </>
      )}
    </div>
  );
}
