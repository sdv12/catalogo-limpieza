import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { resolverCatalogo } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { mapasAuditoria } from "@/lib/catalog-data";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { AuditEntry } from "@/components/audit/AuditEntry";

export const metadata = { title: "Historial del producto" };

const POR_PAGINA = 25;

export default async function HistorialProductoPage({
  params,
  searchParams,
}: {
  params: Promise<{ catalogo: string; id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { catalogo: slug, id } = await params;
  const { page } = await searchParams;
  const catalogo = await resolverCatalogo(slug);
  const supabase = await createClient();

  const { data: prod } = await supabase
    .from("products")
    .select("id, name")
    .eq("id", id)
    .eq("catalog_id", catalogo.id)
    .maybeSingle();
  if (!prod) notFound();

  const pagina = Math.max(1, Number(page) || 1);
  const desde = (pagina - 1) * POR_PAGINA;

  const [{ data: entradas, count }, maps] = await Promise.all([
    supabase
      .from("audit_log")
      .select(
        "id, entity_type, action, changes, summary, actor_email, product_id, batch_id, created_at",
        { count: "exact" },
      )
      .eq("catalog_id", catalogo.id)
      .eq("product_id", id)
      .order("created_at", { ascending: false })
      .range(desde, desde + POR_PAGINA - 1),
    mapasAuditoria(supabase, catalogo.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href={`/panel/${slug}/productos/${id}`}
        className="inline-flex items-center gap-1 text-sm text-texto-sec hover:text-texto"
      >
        <ChevronLeft size={16} />
        Volver al producto
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-texto">Historial</h1>
        <p className="mt-1 text-sm text-texto-sec">{prod.name}</p>
      </div>

      {(entradas?.length ?? 0) === 0 ? (
        <EmptyState
          titulo="Sin cambios registrados"
          descripcion="Todavía no hay actividad para este producto."
        />
      ) : (
        <>
          <Card>
            <CardBody className="py-0">
              {entradas!.map((e) => (
                <AuditEntry key={e.id} entrada={e} slug={slug} maps={maps} />
              ))}
            </CardBody>
          </Card>
          <Pagination
            total={count ?? 0}
            porPagina={POR_PAGINA}
            paginaActual={pagina}
            hacerHref={(p) =>
              `/panel/${slug}/productos/${id}/historial${p > 1 ? `?page=${p}` : ""}`
            }
          />
        </>
      )}
    </div>
  );
}
