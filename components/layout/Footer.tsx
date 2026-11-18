import pkg from "@/package.json";

/** Pie común del panel: versión, origen y crédito. */
export function Footer() {
  return (
    <footer className="space-y-1.5 px-4 pt-6 pb-4 text-center text-xs text-texto-tenue print:hidden">
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span>Panel de catálogo v{pkg.version}</span>
        <span aria-hidden>·</span>
        <span>Producto cordobés 🧉</span>
      </p>
      <p className="flex items-center justify-center gap-1.5">
        <span>Hecho por sdv12</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/credito/sdv12-logo.png" alt="" width={18} height={18} className="size-[18px] rounded" />
      </p>
    </footer>
  );
}
