import Link from "next/link";
import {
  Package,
  PackageX,
  AlertTriangle,
  FolderTree,
  Users,
  Truck,
  Plus,
  Upload,
  Tags,
  Receipt,
  ChevronRight,
} from "lucide-react";
import { resolverCatalogo, puedeEditar, esAdminCatalogo, tienePermiso } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { facturacionHabilitada } from "@/lib/facturacion/tusfacturas";
import { CAMBIOS_RECIENTES_DASHBOARD } from "@/lib/constants";
import { formatearMoneda, formatearNumero } from "@/lib/format";
import { Card, CardBody } from "@/components/ui/Card";
import { RecentActivity } from "@/components/audit/RecentActivity";

type Stats = {
  productos_total?: number;
  productos_activos?: number;
  productos_inactivos?: number;
  variantes_total?: number;
  stock_bajo?: number;
  sin_stock?: number;
  categorias?: number;
  clientes?: number;
  proveedores?: number;
  inventario_costo?: number;
  unidades_stock?: number;
  deuda_total?: number;
  clientes_con_deuda?: number;
  clientes_en_mora?: number;
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
  const clientes = stats.clientes ?? 0;
  const proveedores = stats.proveedores ?? 0;

  const productIds = [
    ...new Set(
      (cambios ?? []).map((c) => c.product_id).filter((x): x is string => !!x),
    ),
  ];
  const nombres = new Map<string, string>();
  if (productIds.length) {
    const { data } = await supabase
      .from("products")
      .select("id, name")
      .in("id", productIds);
    for (const p of data ?? []) nombres.set(p.id, p.name);
  }

  const stockBajo = stats.stock_bajo ?? 0;
  const invCosto = Number(stats.inventario_costo ?? 0);

  const tarjetas = [
    {
      label: "Productos",
      valor: stats.productos_total ?? 0,
      detalle: `${stats.productos_activos ?? 0} activos · ${
        stats.variantes_total ?? 0
      } presentaciones`,
      icon: Package,
      href: `/panel/${slug}/productos`,
    },
    {
      label: "Stock bajo",
      valor: stockBajo,
      detalle: stockBajo > 0 ? "productos a reponer" : "todo en orden",
      icon: AlertTriangle,
      href: `/panel/${slug}/productos?stock=low`,
      alerta: stockBajo > 0,
    },
    {
      label: "Inactivos",
      valor: stats.productos_inactivos ?? 0,
      detalle: "no visibles en la web",
      icon: PackageX,
      href: `/panel/${slug}/productos?estado=inactive`,
    },
    {
      label: "Categorías",
      valor: stats.categorias ?? 0,
      detalle: "en el catálogo",
      icon: FolderTree,
      href: `/panel/${slug}/categorias`,
    },
    {
      label: "Clientes",
      valor: clientes ?? 0,
      detalle:
        (stats.clientes_con_deuda ?? 0) > 0
          ? `con deuda: ${stats.clientes_con_deuda}${
              (stats.clientes_en_mora ?? 0) > 0
                ? ` · en mora: ${stats.clientes_en_mora}`
                : ""
            }`
          : "activos",
      icon: Users,
      href: `/panel/${slug}/clientes`,
      alerta: (stats.clientes_en_mora ?? 0) > 0,
    },
    {
      label: "Proveedores",
      valor: proveedores ?? 0,
      detalle: "activos",
      icon: Truck,
      href: `/panel/${slug}/proveedores`,
    },
  ];

  const admin = esAdminCatalogo(catalogo);
  const accesos = [
    { label: "Nuevo producto", icon: Plus, href: `/panel/${slug}/productos/nuevo`, show: puedeEditar(catalogo) },
    { label: "Nuevo cliente", icon: Users, href: `/panel/${slug}/clientes/nuevo`, show: puedeEditar(catalogo) },
    { label: "Carga masiva", icon: Upload, href: `/panel/${slug}/importar`, show: tienePermiso(catalogo, "carga_masiva") },
    { label: "Precios en lote", icon: Tags, href: `/panel/${slug}/precios`, show: tienePermiso(catalogo, "precios_lote") },
  ].filter((a) => a.show);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-texto">{catalogo.name}</h1>
        <p className="mt-1 text-sm text-texto-sec">
          Resumen del catálogo y actividad reciente.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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

      {(invCosto > 0 || (stats.unidades_stock ?? 0) > 0) && (
        <Card>
          <CardBody className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
            <div>
              <span className="text-xs uppercase tracking-wide text-texto-sec">
                Valor de inventario (a costo)
              </span>
              <p className="text-lg font-semibold tabular-nums text-texto">
                {invCosto > 0 ? formatearMoneda(invCosto) : "—"}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wide text-texto-sec">
                Unidades en stock
              </span>
              <p className="text-lg font-semibold tabular-nums text-texto">
                {formatearNumero(stats.unidades_stock ?? 0)}
              </p>
            </div>
            {(stats.sin_stock ?? 0) > 0 && (
              <div>
                <span className="text-xs uppercase tracking-wide text-texto-sec">
                  Productos sin stock
                </span>
                <p className="text-lg font-semibold tabular-nums text-alerta">
                  {stats.sin_stock}
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {admin && (stats.deuda_total ?? 0) > 0 && (
        <Link href={`/panel/${slug}/clientes?deuda=con_deuda`}>
          <Card className="transition-colors hover:border-primario">
            <CardBody className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
              <div>
                <span className="text-xs uppercase tracking-wide text-texto-sec">
                  Cuentas por cobrar
                </span>
                <p className="text-lg font-semibold tabular-nums text-error">
                  {formatearMoneda(stats.deuda_total ?? 0)}
                </p>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-texto-sec">
                  Clientes con deuda
                </span>
                <p className="text-lg font-semibold tabular-nums text-texto">
                  {stats.clientes_con_deuda ?? 0}
                </p>
              </div>
              {(stats.clientes_en_mora ?? 0) > 0 && (
                <div>
                  <span className="text-xs uppercase tracking-wide text-texto-sec">
                    En mora
                  </span>
                  <p className="text-lg font-semibold tabular-nums text-alerta">
                    {stats.clientes_en_mora}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        </Link>
      )}

      {admin && !facturacionHabilitada() && (
        <Link href={`/panel/${slug}/facturacion`}>
          <Card className="border-alerta/40 bg-alerta-suave/40 transition-colors hover:border-alerta">
            <CardBody className="flex items-center gap-3">
              <Receipt size={20} className="shrink-0 text-alerta" />
              <div className="flex-1">
                <p className="text-sm font-medium text-texto">
                  Facturación electrónica pendiente de configurar
                </p>
                <p className="text-xs text-texto-sec">
                  Conectá TusFacturasAPP para poder emitir comprobantes AFIP/ARCA más
                  adelante.
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-texto-tenue" />
            </CardBody>
          </Card>
        </Link>
      )}

      {accesos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {accesos.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="inline-flex items-center gap-1.5 rounded-comp-sm border border-linea-fuerte bg-superficie px-3 py-1.5 text-sm text-texto hover:bg-superficie-sec"
            >
              <a.icon size={14} />
              {a.label}
            </Link>
          ))}
        </div>
      )}

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
              product_name: c.product_id
                ? (nombres.get(c.product_id) ?? null)
                : null,
            }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}
