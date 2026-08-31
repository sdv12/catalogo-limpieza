import Link from "next/link";

export function Pagination({
  total,
  porPagina,
  paginaActual,
  hacerHref,
}: {
  total: number;
  porPagina: number;
  paginaActual: number;
  hacerHref: (pagina: number) => string;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;
  const desde = (paginaActual - 1) * porPagina + 1;
  const hasta = Math.min(total, paginaActual * porPagina);

  return (
    <div className="flex items-center justify-between gap-3 text-sm text-texto-sec">
      <span>
        {desde}–{hasta} de {total}
      </span>
      <div className="flex gap-1">
        <PageLink
          href={hacerHref(paginaActual - 1)}
          disabled={paginaActual <= 1}
        >
          Anterior
        </PageLink>
        <PageLink
          href={hacerHref(paginaActual + 1)}
          disabled={paginaActual >= paginas}
        >
          Siguiente
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-comp-sm border border-linea px-3 py-1.5 text-texto-tenue opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-comp-sm border border-linea-fuerte px-3 py-1.5 text-texto hover:bg-superficie-sec"
    >
      {children}
    </Link>
  );
}
