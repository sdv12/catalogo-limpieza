"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import type { Tier } from "./_data";

export function BarraImpresion({
  slug,
  titulo,
  tiers,
  tierActual,
  children,
}: {
  slug: string;
  titulo: string;
  tiers?: Tier[];
  tierActual?: string | null;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setTier = (code: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (code) p.set("tier", code);
    else p.delete("tier");
    router.replace(`${pathname}?${p.toString()}`);
  };

  return (
    <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-[#e2e5e9] bg-white/95 px-4 py-3 backdrop-blur">
      <a
        href={`/panel/${slug}/productos${searchParams.toString() ? `?${quitarTier(searchParams)}` : ""}`}
        className="inline-flex items-center gap-1.5 text-sm text-[#5c6570] hover:text-[#1a1d21]"
      >
        <ArrowLeft size={15} />
        Volver
      </a>
      <span className="text-sm font-medium text-[#1a1d21]">{titulo}</span>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {children}
        {tiers && tiers.length > 1 && (
          <label className="flex items-center gap-1.5 text-xs text-[#5c6570]">
            Precio
            <select
              value={tierActual ?? ""}
              onChange={(e) => setTier(e.target.value)}
              className="rounded-md border border-[#cdd2d8] bg-white px-2 py-1 text-sm text-[#1a1d21]"
            >
              {tiers.map((t) => (
                <option key={t.id} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-[#0d9488] px-3.5 py-1.5 text-sm font-medium text-white hover:bg-[#0f766e]"
        >
          <Printer size={15} />
          Imprimir / Guardar PDF
        </button>
      </div>
    </div>
  );
}

function quitarTier(sp: URLSearchParams): string {
  const p = new URLSearchParams(sp.toString());
  p.delete("tier");
  return p.toString();
}
