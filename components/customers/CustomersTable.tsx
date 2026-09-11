import Link from "next/link";
import { cn } from "@/lib/cn";
import { TableWrap, Table, Th, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { ETIQUETA_CONDICION_IVA, type CondicionIVA } from "@/lib/constants";
import { formatearMoneda, formatearFecha } from "@/lib/format";
import { CustomerRowActions } from "@/components/customers/CustomerRowActions";

type Fila = {
  id: string;
  name: string;
  doc_type: string | null;
  doc_number: string | null;
  tax_condition: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  is_active: boolean;
  is_deleted: boolean;
  balance: number;
  next_due_date: string | null;
  vendedor: string | null;
};

export function CustomersTable({
  slug,
  filas,
  soloLectura,
}: {
  slug: string;
  filas: Fila[];
  soloLectura: boolean;
}) {
  const hoy = new Date(new Date().toDateString());

  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Cliente</Th>
            <Th>Documento</Th>
            <Th>Condición IVA</Th>
            <Th>Vendedor</Th>
            <Th className="text-right">Saldo</Th>
            <Th>Estado</Th>
            <Th className="w-10"></Th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const vencido =
              f.balance > 0 && f.next_due_date != null && new Date(f.next_due_date) < hoy;
            return (
              <tr
                key={f.id}
                className={cn(f.is_deleted && "text-texto-tenue opacity-60")}
              >
                <Td>
                  <Link
                    href={`/panel/${slug}/clientes/${f.id}`}
                    className="font-medium text-texto hover:text-primario"
                  >
                    {f.name}
                  </Link>
                  <div className="text-xs text-texto-tenue">
                    {f.city || f.email || f.phone || ""}
                  </div>
                </Td>
                <Td className="whitespace-nowrap text-texto-sec">
                  {f.doc_type ? `${f.doc_type} ${f.doc_number ?? ""}` : "—"}
                </Td>
                <Td className="whitespace-nowrap text-texto-sec">
                  {ETIQUETA_CONDICION_IVA[f.tax_condition as CondicionIVA] ??
                    f.tax_condition}
                </Td>
                <Td className="whitespace-nowrap text-texto-sec">
                  {f.vendedor ?? "—"}
                </Td>
                <Td className="whitespace-nowrap text-right">
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      f.balance > 0 ? "text-error" : "text-texto-sec",
                    )}
                  >
                    {f.balance > 0 ? formatearMoneda(f.balance) : "—"}
                  </span>
                  {f.balance > 0 && f.next_due_date && (
                    <div className={cn("text-xs", vencido ? "text-error" : "text-texto-tenue")}>
                      {vencido ? "Vencido " : "Vence "}
                      {formatearFecha(f.next_due_date)}
                    </div>
                  )}
                </Td>
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
                    <CustomerRowActions
                      slug={slug}
                      cliente={{ id: f.id, name: f.name, isDeleted: f.is_deleted }}
                    />
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </TableWrap>
  );
}
