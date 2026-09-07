"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, ChevronDown, Tag, ListChecks, BookOpen } from "lucide-react";

const CLAVES = ["q", "categoria", "marca", "proveedor", "estado", "stock"];

export function BotonImprimir({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const qs = (() => {
    const p = new URLSearchParams();
    for (const k of CLAVES) {
      const v = searchParams.get(k);
      if (v) p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : "";
  })();

  const opciones = [
    {
      href: `/imprimir/${slug}/etiquetas${qs}`,
      label: "Etiquetas de góndola",
      icon: Tag,
    },
    {
      href: `/imprimir/${slug}/lista${qs}`,
      label: "Lista para pedido / conteo",
      icon: ListChecks,
    },
    {
      href: `/imprimir/${slug}/catalogo${qs}`,
      label: "Catálogo para revendedores",
      icon: BookOpen,
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="inline-flex h-10 items-center gap-2 rounded-comp-sm border border-linea-fuerte bg-superficie px-3 text-sm text-texto hover:bg-superficie-sec"
      >
        <Printer size={16} />
        Imprimir
        <ChevronDown size={14} className="text-texto-tenue" />
      </button>
      {abierto && (
        <div className="absolute right-0 z-20 mt-1 w-60 rounded-comp border border-linea bg-superficie py-1 shadow-[var(--sombra-pop)]">
          <p className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-texto-tenue">
            Genera un PDF con los productos filtrados
          </p>
          {opciones.map((o) => (
            <a
              key={o.href}
              href={o.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setAbierto(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-texto hover:bg-superficie-sec"
            >
              <o.icon size={15} className="text-texto-tenue" />
              {o.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
