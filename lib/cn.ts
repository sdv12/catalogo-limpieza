import { twMerge } from "tailwind-merge";

type ClassValue = string | number | null | false | undefined | ClassValue[];

/** Une clases de Tailwind resolviendo conflictos (la última gana). */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    if (Array.isArray(v)) out.push(cn(...v));
    else out.push(String(v));
  }
  return twMerge(out.join(" "));
}
