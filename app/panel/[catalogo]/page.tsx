import Link from "next/link";
import { Package, PackageX, AlertTriangle, FolderTree } from "lucide-react";
import { resolverCatalogo } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { CAMBIOS_RECIENTES_DASHBOARD } from "@/lib/constants";
import { Card, CardBody } from "@/components/ui/Card";
import { RecentActivity } from "@/components/audit/RecentActivity";

type Stats = {
  productos_total?: number;
  productos_activos?: number;
  productos_inactivos?: number;
  variantes_total?: number;
  stock_bajo?: number;
  categorias?: number;
};

export default async function CatalogoDashboardPage({
  params,
}: {
  params: Promise<{ catalogo: string }>;
}) {
  const { catalogo: slug } = await params;
  const catalogo = await resolverCatalogo(slug);
  const supabase = await createClient();

  const [{ data: statsRaw }, { data: cambios }] = await Promise.all([
    supabase.rpc("catalog_stats", { p_catalog_id: catalogo.id }),
    supabase
      .from("audit_log")
      .select("id, entity_type, action, summary, actor_email, product_id, created_at")
      .eq("catalog_id", catalogo.id)
      .order("created_at", { ascending: false })
      .limit(CAMBIOS_RECIENTES_DASHBOARD),
  ]);

  const stats = (statsRaw ?? {}) as Stats;

  const productIds = [
    ...new Set((cambios ?? []).map((c) => c.product_id).filter((x): x is string => !!x)),
  ];
  const nombres = new Map<string, string>();
  if (productIds.length) {
    const { data } = await supabase
      .from("products")
      .select("id, name")
      .in("id", productIds);
    for (const p of data ?? []) nombres.set(p.id, p.name);
  }

  const tarjetas = [
    {
      label: "Productos",
      valor: stats.productos_total ?? 0,
      detalle: `${stats.productos_activos ?? 0} activos`,
      icon: Package,
      href: `/panel/${slug}/productos`,
    },
    {
      label: "Stock bajo",
      valor: stats.stock_bajo ?? 0,
      detalle: "productos a reponer",
      icon: AlertTriangle,
      href: `/panel/${slug}/productos?stock=low`,
      alerta: (stats.stock_bajo ?? 0) > 0,
    },
    {
      label: "Inactivos",
      valor: stats.productos_inactivos ?? 0,
      detalle: "no visibles",
      icon: PackageX,
      href: `/panel/${slug}/productos?estado=inactive`,
    },
    {
      label: "Categorías",
      valor: stats.categorias ?? 0,
      detalle: `${stats.variantes_total ?? 0} presentaciones`,
      icon: FolderTree,
      href: `/panel/${slug}/categorias`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-texto">{catalogo.name}</h1>
        <p className="mt-1 text-sm text-texto-sec">
          Resumen del catálogo y actividad reciente.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <Link key={t.label} href={t.href}>
            <Card className="h-full p-4 transition-colors hover:border-primario">
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-texto-sec">
                  {t.label}
                </span>
                <t.icon
                  size={16}
                  className={t.alerta ? "text-alerta" : "text-texto-tenue"}
                />
              </div>
              <p
                className={`mt-2 text-2xl font-semibold tabular-nums ${
                  t.alerta ? "text-alerta" : "text-texto"
                }`}
              >
                {t.valor}
              </p>
              <p className="text-xs text-texto-tenue">{t.detalle}</p>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardBody>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-texto">Últimos cambios</h2>
            <Link
              href={`/panel/${slug}/actividad`}
              className="text-xs font-medium text-primario hover:underline"
            >
              Ver toda la actividad
            </Link>
          </div>
          <RecentActivity
            slug={slug}
            cambios={(cambios ?? []).map((c) => ({
              ...c,
              product_name: c.product_id ? (nombres.get(c.product_id) ?? null) : null,
            }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}
