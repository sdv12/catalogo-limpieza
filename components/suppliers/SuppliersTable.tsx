import Link from "next/link";
import { cn } from "@/lib/cn";
import { TableWrap, Table, Th, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { SupplierRowActions } from "@/components/suppliers/SupplierRowActions";

type Fila = {
  id: string;
  name: string;
  doc_type: string | null;
  doc_number: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  payment_terms: string | null;
  is_active: boolean;
  is_deleted: boolean;
};

export function SuppliersTable({
  slug,
  filas,
  soloLectura,
}: {
  slug: string;
  filas: Fila[];
  soloLectura: boolean;
}) {
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Proveedor</Th>
            <Th>Documento</Th>
            <Th>Contacto</Th>
            <Th>Condición de pago</Th>
            <Th>Estado</Th>
            <Th className="w-10"></Th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr
              key={f.id}
              className={cn(f.is_deleted && "text-texto-tenue opacity-60")}
            >
              <Td>
                <Link
                  href={`/panel/${slug}/proveedores/${f.id}`}
                  className="font-medium text-texto hover:text-primario"
                >
                  {f.name}
                </Link>
                {f.city && (
                  <div className="text-xs text-texto-tenue">{f.city}</div>
                )}
              </Td>
              <Td className="whitespace-nowrap text-texto-sec">
                {f.doc_type ? `${f.doc_type} ${f.doc_number ?? ""}` : "—"}
              </Td>
              <Td className="text-texto-sec">
                {f.contact_name || f.email || f.phone || "—"}
              </Td>
              <Td className="text-texto-sec">{f.payment_terms || "—"}</Td>
              <Td>
                {f.is_deleted ? (
                  <Badge tono="error">Eliminado</Badge>
                ) : f.is_active ? (
                  <Badge tono="exito">Activo</Badge>
                ) : (
                  <Badge tono="neutro">Inactivo</Badge>
                )}
              </Td>
              <Td>
                {!soloLectura && (
                  <SupplierRowActions
                    slug={slug}
                    proveedor={{
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
