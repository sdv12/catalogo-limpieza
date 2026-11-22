import { Sparkles } from "lucide-react";
import { resolverCatalogo } from "@/lib/dal";
import { NOVEDADES } from "@/content/novedades";
import { MarcarVistas } from "@/components/novedades/MarcarVistas";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

export const metadata = { title: "Novedades — Catálogo" };

const FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default async function NovedadesPage({
  params,
}: {
  params: Promise<{ catalogo: string }>;
}) {
  const { catalogo: slug } = await params;
  await resolverCatalogo(slug);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <MarcarVistas />
      <div>
        <h1 className="text-xl font-semibold text-texto">Novedades</h1>
        <p className="mt-1 text-sm text-texto-sec">
          Cada vez que se actualiza el panel, se cuenta acá qué cambió y cuándo.
        </p>
      </div>

      <ol className="space-y-4">
        {NOVEDADES.map((n, i) => (
          <li key={n.version}>
            <Card>
              <CardBody className="flex gap-3">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full",
                    i === 0
                      ? "bg-primario text-white"
                      : "bg-superficie-sec text-texto-sec",
                  )}
                >
                  <Sparkles size={16} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-texto-tenue">
                    <time dateTime={n.fecha}>
                      {FECHA.format(new Date(`${n.fecha}T12:00:00Z`))}
                    </time>
                    <span aria-hidden>·</span>
                    <span>versión {n.version}</span>
                    {i === 0 && <Badge tono="exito">Lo último</Badge>}
                  </p>
                  <h2 className="mt-1 font-semibold text-texto">{n.titulo}</h2>
                  <ul className="mt-2 space-y-1.5">
                    {n.cambios.map((c) => (
                      <li key={c} className="flex gap-2 text-sm text-texto-sec">
                        <span
                          aria-hidden
                          className="mt-2 size-1.5 shrink-0 rounded-full bg-primario"
                        />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardBody>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
