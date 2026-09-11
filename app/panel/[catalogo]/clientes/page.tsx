import Link from "next/link";
import { Plus } from "lucide-react";
import { resolverCatalogo, puedeEditar } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { sanitizarBusqueda } from "@/lib/format";
import { vendedoresDelCatalogo } from "@/lib/catalog-data";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { PeopleFilters } from "@/components/common/PeopleFilters";
import { SelectUrl, DateUrl } from "@/components/common/FiltrosUrl";
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
  const hoy = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from("customers")
    .select(
      "id, name, doc_type, doc_number, tax_condition, email, phone, city, is_active, is_deleted, balance, next_due_date, assigned_seller",
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
  if (sp.deuda === "con_deuda") query = query.gt("balance", 0);
  if (sp.deuda === "mora") query = query.gt("balance", 0).lt("next_due_date", hoy);
  if (sp.vencehasta) query = query.gt("balance", 0).lte("next_due_date", sp.vencehasta);
  if (sp.vendedor) query = query.eq("assigned_seller", sp.vendedor);

  // El listado se ordena por documento (DNI/CUIT), como pidió el cliente.
  const { data: filas, count } = await query
    .order("is_deleted")
    .order("doc_number", { nullsFirst: false })
    .order("name")
    .range(desde, desde + POR_PAGINA - 1);

  const soloLectura = !puedeEditar(catalogo);
  const total = count ?? 0;
  const vendedores = await vendedoresDelCatalogo(supabase, catalogo.id);
  const vendedorPorId = new Map(vendedores.map((v) => [v.id, v.label]));

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

      <PeopleFilters
        placeholder="Buscar por nombre, documento o email…"
        extra={
          <>
            <SelectUrl param="deuda" ariaLabel="Filtrar por deuda" className="sm:w-40">
              <option value="">Deuda: todos</option>
              <option value="con_deuda">Con deuda</option>
              <option value="mora">En mora</option>
            </SelectUrl>
            <label className="flex h-10 items-center gap-1.5 text-sm text-texto-sec">
              Vence hasta
              <DateUrl param="vencehasta" ariaLabel="Vence hasta" className="w-auto" />
            </label>
            {vendedores.length > 0 && (
              <SelectUrl param="vendedor" ariaLabel="Filtrar por vendedor" className="sm:w-44">
                <option value="">Todos los vendedores</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </SelectUrl>
            )}
          </>
        }
      />

      {(filas?.length ?? 0) === 0 ? (
        <EmptyState
          titulo="Sin clientes"
          descripcion="Cargá tu primer cliente o ajustá la búsqueda."
        />
      ) : (
        <>
          <CustomersTable
            slug={slug}
            filas={(filas ?? []).map((f) => ({
              ...f,
              balance: Number(f.balance),
              vendedor: f.assigned_seller
                ? (vendedorPorId.get(f.assigned_seller) ?? null)
                : null,
            }))}
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
