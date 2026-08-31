import { BUCKET_IMAGENES } from "@/lib/constants";

/** URL pública de un objeto del bucket de imágenes (bucket público). */
export function imagenUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${BUCKET_IMAGENES}/${encodeURI(path)}`;
}
