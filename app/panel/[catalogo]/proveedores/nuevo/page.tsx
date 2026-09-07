import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { resolverCatalogo, puedeEditar } from "@/lib/dal";
import { SupplierForm } from "@/components/suppliers/SupplierForm";

export const metadata = { title: "Nuevo proveedor" };

export default async function NuevoProveedorPage({
  params,
}: {
  params: Promise<{ catalogo: string }>;
}) {
  const { catalogo: slug } = await params;
  const catalogo = await resolverCatalogo(slug);
  if (!puedeEditar(catalogo)) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href={`/panel/${slug}/proveedores`}
        className="inline-flex items-center gap-1 text-sm text-texto-sec hover:text-texto"
      >
        <ChevronLeft size={16} />
        Proveedores
      </Link>
      <h1 className="text-xl font-semibold text-texto">Nuevo proveedor</h1>
      <SupplierForm slug={slug} />
    </div>
  );
}
