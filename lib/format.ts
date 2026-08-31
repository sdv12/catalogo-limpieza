import { MONEDA_DEFAULT } from "@/lib/constants";

const fmtMoneda = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: MONEDA_DEFAULT,
});

const fmtNumero = new Intl.NumberFormat("es-AR");

const fmtFechaHora = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
});

const fmtFecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" });

export function formatearMoneda(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(valor)) return "—";
  return fmtMoneda.format(valor);
}

export function formatearNumero(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(valor)) return "—";
  return fmtNumero.format(valor);
}

export function formatearFechaHora(fecha: string | Date | null | undefined): string {
  if (!fecha) return "—";
  return fmtFechaHora.format(new Date(fecha));
}

export function formatearFecha(fecha: string | Date | null | undefined): string {
  if (!fecha) return "—";
  return fmtFecha.format(new Date(fecha));
}

/** "hace 5 minutos", "hace 2 días" — para la actividad reciente. */
export function tiempoRelativo(fecha: string | Date): string {
  const rtf = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });
  const diffMs = new Date(fecha).getTime() - Date.now();
  const diffSeg = Math.round(diffMs / 1000);
  const abs = Math.abs(diffSeg);

  if (abs < 60) return rtf.format(diffSeg, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSeg / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSeg / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(diffSeg / 86400), "day");
  if (abs < 31536000) return rtf.format(Math.round(diffSeg / 2592000), "month");
  return rtf.format(Math.round(diffSeg / 31536000), "year");
}

/** Genera un slug a partir de un texto (categorías, etc.). */
export function generarSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
