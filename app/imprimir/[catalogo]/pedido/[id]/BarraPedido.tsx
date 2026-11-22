"use client";

import { Printer, ArrowLeft } from "lucide-react";

export function BarraPedido({ volver, titulo }: { volver: string; titulo: string }) {
  return (
    <div className="no-print sticky top-0 z-10 flex items-center gap-3 border-b border-[#e2e5e9] bg-white/95 px-4 py-3 backdrop-blur">
      <a
        href={volver}
        className="inline-flex items-center gap-1.5 text-sm text-[#5c6570] hover:text-[#1a1d21]"
      >
        <ArrowLeft size={15} />
        Volver
      </a>
      <span className="text-sm font-medium text-[#1a1d21]">{titulo}</span>
      <button
        type="button"
        onClick={() => window.print()}
        className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-[#0d9488] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0f766e]"
      >
        <Printer size={15} />
        Imprimir / PDF
      </button>
    </div>
  );
}
