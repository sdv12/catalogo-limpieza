import Link from "next/link";
import { Plus } from "lucide-react";
import { resolverCatalogo, puedeEditar } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { sanitizarBusqueda } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { PeopleFilters } from "@/components/common/PeopleFilters";
import { CustomersTable } from "@/components/customers/CustomersTable";

export const metadata = { title: "Clientes — Catálogo" };

const POR_PAGINA = 25;
type SP = Record<string, string | undefined>;

export default async function ClientesPage({
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
  const verEliminados = sp.eliminados === "1";
  const desde = (pagina - 1) * POR_PAGINA;

  let query = supabase
    .from("customers")
    .select(
      "id, name, doc_type, doc_number, tax_condition, email, phone, city, is_active, is_deleted",
      { count: "exact" },
    )
    .eq("catalog_id", catalogo.id);

  if (!verEliminados) query = query.eq("is_deleted", false);
  if (sp.estado === "activo") query = query.eq("is_active", true);
  if (sp.estado === "inactivo") query = query.eq("is_active", false);
  if (sp.q?.trim()) {
    const t = sanitizarBusqueda(sp.q);
    query = query.or(`name.ilike.%${t}%,doc_number.ilike.%${t}%,email.ilike.%${t}%`);
  }

  // El listado se ordena por documento (DNI/CUIT), como pidió el cliente.
  const { data: filas, count } = await query
    .order("is_deleted")
    .order("doc_number", { nullsFirst: false })
    .order("name")
    .range(desde, desde + POR_PAGINA - 1);

  const soloLectura = !puedeEditar(catalogo);
  const total = count ?? 0;

  const hacerHref = (cambios: SP) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...cambios })) {
      if (v) q.set(k, v);
    }
    const s = q.toString();
    return `/panel/${slug}/clientes${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-texto">Clientes</h1>
          <p className="mt-1 text-sm text-texto-sec">
            {total} {total === 1 ? "cliente" : "clientes"}
            {verEliminados ? " (incluye eliminados)" : ""}
          </p>
        </div>
        {!soloLectura && (
          <Link href={`/panel/${slug}/clientes/nuevo`}>
            <Button>
              <Plus size={16} />
              Nuevo cliente
            </Button>
          </Link>
        )}
      </div>

      <PeopleFilters placeholder="Buscar por nombre, documento o email…" />

      {(filas?.length ?? 0) === 0 ? (
        <EmptyState
          titulo="Sin clientes"
          descripcion="Cargá tu primer cliente o ajustá la búsqueda."
        />
      ) : (
        <>
          <CustomersTable
            slug={slug}
            filas={filas ?? []}
            soloLectura={soloLectura}
          />
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
