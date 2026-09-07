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

export function ProductsTable({
  slug,
  filas,
  soloLectura,
  orden,
  hacerHref,
}: {
  slug: string;
  filas: Fila[];
  soloLectura: boolean;
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
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th className="w-12"></Th>
            <Th>{sortLink("name", "Producto")}</Th>
            <Th>Categoría</Th>
            <Th className="text-right">Costo</Th>
            <Th className="text-right">Precio</Th>
            <Th className="text-right">Stock</Th>
            <Th>{sortLink("status", "Estado")}</Th>
            <Th className="w-10"></Th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr
              key={f.id}
              className={f.is_deleted ? "opacity-60" : undefined}
            >
              <Td>
                <div className="size-9 overflow-hidden rounded-comp-sm bg-superficie-sec">
                  {f.primary_image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagenUrl(f.primary_image)}
                      alt=""
                      className="size-full object-cover"
                    />
                  )}
                </div>
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
                  {Number(f.variant_count) === 1 ? "presentación" : "presentaciones"}
                  {f.supplier_name ? ` · ${f.supplier_name}` : ""}
                </div>
              </Td>
              <Td className="whitespace-nowrap text-texto-sec">
                {f.category_name ?? "—"}
              </Td>
              <Td className="whitespace-nowrap text-right text-texto-sec tabular-nums">
                {f.min_cost == null ? "—" : formatearMoneda(Number(f.min_cost))}
              </Td>
              <Td className="whitespace-nowrap text-right">
                {f.min_price == null
                  ? "—"
                  : Number(f.min_price) === Number(f.max_price)
                    ? formatearMoneda(Number(f.min_price))
                    : `${formatearMoneda(Number(f.min_price))} – ${formatearMoneda(Number(f.max_price))}`}
              </Td>
              <Td className="whitespace-nowrap text-right">
                <span className="tabular-nums">
                  {formatearNumero(Number(f.total_stock))}
                </span>
                {f.low_stock && <LowStockBadge className="ml-2" />}
              </Td>
              <Td>
                {f.is_deleted ? (
                  <Badge tono="error">De baja</Badge>
                ) : f.status === "active" ? (
                  <Badge tono="exito">{ETIQUETA_ESTADO.active}</Badge>
                ) : (
                  <Badge tono="neutro">{ETIQUETA_ESTADO.inactive}</Badge>
                )}
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
  );
}
