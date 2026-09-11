import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Database } from "@/types/database";
import { TableWrap, Table, Th, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { LowStockBadge } from "@/components/products/LowStockBadge";
import { ProductRowActions } from "@/components/products/ProductRowActions";
import { ETIQUETA_ESTADO } from "@/lib/constants";
import { formatearMoneda, formatearNumero } from "@/lib/format";
import { imagenUrl } from "@/lib/storage";

type Fila = Database["public"]["Functions"]["search_products"]["Returns"][number];

function precioTexto(f: Fila): string {
  if (f.min_price == null) return "—";
  return Number(f.min_price) === Number(f.max_price)
    ? formatearMoneda(Number(f.min_price))
    : `${formatearMoneda(Number(f.min_price))} – ${formatearMoneda(Number(f.max_price))}`;
}

function EstadoBadge({ f }: { f: Fila }) {
  if (f.is_deleted) return <Badge tono="error">De baja</Badge>;
  return f.status === "active" ? (
    <Badge tono="exito">{ETIQUETA_ESTADO.active}</Badge>
  ) : (
    <Badge tono="neutro">{ETIQUETA_ESTADO.inactive}</Badge>
  );
}

function Miniatura({ path }: { path: string | null }) {
  return (
    <div className="size-10 shrink-0 overflow-hidden rounded-comp-sm bg-superficie-sec">
      {path && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imagenUrl(path)} alt="" className="size-full object-cover" />
      )}
    </div>
  );
}

export function ProductsTable({
  slug,
  filas,
  soloLectura,
  admin,
  orden,
  hacerHref,
}: {
  slug: string;
  filas: Fila[];
  soloLectura: boolean;
  admin: boolean;
  orden: { sort: string; dir: string };
  hacerHref: (cambios: Record<string, string | undefined>) => string;
}) {
  const sortLink = (campo: string, label: string) => {
    const activo = orden.sort === campo;
    const nuevaDir = activo && orden.dir === "asc" ? "desc" : "asc";
    const Icono = !activo ? ArrowUpDown : orden.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <Link
        href={hacerHref({ sort: campo, dir: nuevaDir, page: undefined })}
        className="inline-flex items-center gap-1 hover:text-texto"
      >
        {label}
        <Icono size={12} />
      </Link>
    );
  };

  return (
    <>
      {/* Móvil: tarjetas */}
      <ul className="space-y-2 sm:hidden">
        {filas.map((f) => (
          <li
            key={f.id}
            className={`rounded-comp border border-linea bg-superficie p-3 ${
              f.is_deleted ? "opacity-60" : ""
            }`}
          >
            <div className="flex gap-3">
              <Miniatura path={f.primary_image} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/panel/${slug}/productos/${f.id}`}
                    className="font-medium leading-tight text-texto hover:text-primario"
                  >
                    {f.name}
                  </Link>
                  {!soloLectura && (
                    <ProductRowActions
                      slug={slug}
                      producto={{ id: f.id, name: f.name, isDeleted: f.is_deleted }}
                    />
                  )}
                </div>
                <p className="mt-0.5 text-xs text-texto-tenue">
                  {f.base_sku ? `${f.base_sku} · ` : ""}
                  {f.category_name ?? "sin categoría"}
                  {admin && f.supplier_name ? ` · ${f.supplier_name}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium tabular-nums">{precioTexto(f)}</span>
                  {admin && f.min_cost != null && (
                    <span className="text-xs text-texto-tenue">
                      costo {formatearMoneda(Number(f.min_cost))}
                    </span>
                  )}
                  <span className="text-xs text-texto-sec">
                    stock {formatearNumero(Number(f.total_stock))}
                  </span>
                  {f.low_stock && <LowStockBadge />}
                  <span className="ml-auto">
                    <EstadoBadge f={f} />
                  </span>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: tabla */}
      <div className="hidden sm:block">
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th className="w-12"></Th>
                <Th>{sortLink("name", "Producto")}</Th>
                <Th>Categoría</Th>
                {admin && <Th className="text-right">Costo</Th>}
                <Th className="text-right">Precio</Th>
                <Th className="text-right">Stock</Th>
                <Th>{sortLink("status", "Estado")}</Th>
                <Th className="w-10"></Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className={f.is_deleted ? "opacity-60" : undefined}>
                  <Td>
                    <Miniatura path={f.primary_image} />
                  </Td>
                  <Td>
                    <Link
                      href={`/panel/${slug}/productos/${f.id}`}
                      className="font-medium text-texto hover:text-primario"
                    >
                      {f.name}
                    </Link>
                    <div className="text-xs text-texto-tenue">
                      {f.base_sku ? `${f.base_sku} · ` : ""}
                      {formatearNumero(Number(f.variant_count))}{" "}
                      {Number(f.variant_count) === 1
                        ? "presentación"
                        : "presentaciones"}
                      {admin && f.supplier_name ? ` · ${f.supplier_name}` : ""}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-texto-sec">
                    {f.category_name ?? "—"}
                  </Td>
                  {admin && (
                    <Td className="whitespace-nowrap text-right text-texto-sec tabular-nums">
                      {f.min_cost == null
                        ? "—"
                        : formatearMoneda(Number(f.min_cost))}
                    </Td>
                  )}
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    {precioTexto(f)}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <span className="tabular-nums">
                      {formatearNumero(Number(f.total_stock))}
                    </span>
                    {f.low_stock && <LowStockBadge className="ml-2" />}
                  </Td>
                  <Td>
                    <EstadoBadge f={f} />
                  </Td>
                  <Td>
                    {!soloLectura && (
                      <ProductRowActions
                        slug={slug}
                        producto={{
                          id: f.id,
                          name: f.name,
                          isDeleted: f.is_deleted,
                        }}
                      />
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </div>
    </>
  );
}
