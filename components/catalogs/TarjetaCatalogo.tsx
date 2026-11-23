import Link from "next/link";
import { ShoppingBag, Store } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ETIQUETA_ROL, type CatalogoAccesible } from "@/lib/roles";

/** Tarjeta para entrar a un catálogo (ecommerce o sucursal). */
export function TarjetaCatalogo({ catalogo: c }: { catalogo: CatalogoAccesible }) {
  const Icono = c.kind === "sucursal" ? Store : ShoppingBag;
  return (
    <Link href={`/panel/${c.slug}`}>
      <Card className="flex h-full items-center gap-4 p-5 transition-colors hover:border-primario">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-comp bg-primario-suave text-primario-fuerte">
          <Icono size={22} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium text-texto">{c.name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-texto-tenue">
              {c.kind === "sucursal" ? "Sucursal" : "Tienda online"}
            </span>
            <Badge tono={c.rol === "viewer" ? "alerta" : "neutro"}>{ETIQUETA_ROL[c.rol]}</Badge>
          </span>
        </span>
      </Card>
    </Link>
  );
}
