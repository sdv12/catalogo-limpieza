import { notFound } from "next/navigation";
import { resolverCatalogo, esAdminCatalogo } from "@/lib/dal";
import { ImportWizard } from "@/components/import/ImportWizard";

export const metadata = { title: "Carga masiva — Catálogo" };

export default async function ImportarPage({
  params,
}: {
  params: Promise<{ catalogo: string }>;
}) {
  const { catalogo: slug } = await params;
  const catalogo = await resolverCatalogo(slug);
  if (!esAdminCatalogo(catalogo)) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-texto">Carga masiva</h1>
        <p className="mt-1 text-sm text-texto-sec">
          Importá productos desde una planilla. Se valida todo antes de escribir
          nada y queda registrado en la auditoría como una operación en lote.
        </p>
      </div>

      <ImportWizard slug={slug} />
    </div>
  );
}
