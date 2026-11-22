import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { resolverCatalogo, puedeEditar, esAdminCatalogo, tienePermiso } from "@/lib/dal";
import { cargarPedido } from "@/lib/ventas-data";
import { ETIQUETA_CANAL } from "@/lib/ventas";
import { OrderForm, type PedidoEditable } from "@/components/ventas/OrderForm";

export const metadata = { title: "Editar pedido — Catálogo" };

export default async function EditarVentaPage({
  params,
}: {
  params: Promise<{ catalogo: string; id: string }>;
}) {
  const { catalogo: slug, id } = await params;
  const catalogo = await resolverCatalogo(slug);
  if (!puedeEditar(catalogo)) notFound();
  const p = await cargarPedido(catalogo, id);
  if (!p) notFound();
  if (p.status !== "nuevo") redirect(`/panel/${slug}/ventas/${id}`);

  const editable: PedidoEditable = {
    id: p.id,
    number: p.number,
    cliente: p.cliente
      ? {
          id: p.cliente.id,
          name: p.cliente.name,
          doc: p.cliente.doc,
          balance: p.cliente.balance,
          creditLimit: p.cliente.creditLimit,
        }
      : null,
    payment: p.payment,
    dueDate: p.dueDate,
    notes: p.notes,
    contacto:
      p.channel !== "panel"
        ? {
            canal: p.channelName ?? ETIQUETA_CANAL[p.channel],
            nombre: p.contacto.nombre,
            telefono: p.contacto.telefono,
            email: p.contacto.email,
            direccion: p.contacto.direccion,
          }
        : null,
    lineas: p.items.map((i) => ({
      variantId: i.variantId,
      producto: i.producto,
      presentacion: i.presentacion,
      sku: i.sku,
      stock: i.stockActual,
      cantidad: i.cantidad,
      // si no fue manual, la base lo recalcula al guardar con el precio vigente
      precioLista: i.origen === "manual" ? i.precioLista : i.precio,
      origen: i.origen === "especial" ? "especial" : "lista",
      costo: i.costo,
      precioManual: i.origen === "manual" ? i.precio : null,
      motivo: i.motivo,
      guardarFijo: i.guardarFijo,
    })),
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        href={`/panel/${slug}/ventas/${id}`}
        className="inline-flex items-center gap-1 text-sm text-texto-sec hover:text-texto"
      >
        <ChevronLeft size={16} />
        Pedido #{p.number}
      </Link>
      <h1 className="text-xl font-semibold text-texto">Editar pedido #{p.number}</h1>
      <OrderForm
        slug={slug}
        pedido={editable}
        puedeCambiarPrecio={tienePermiso(catalogo, "precios_especiales")}
        esAdmin={esAdminCatalogo(catalogo)}
      />
    </div>
  );
}
