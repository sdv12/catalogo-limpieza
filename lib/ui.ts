import { toast } from "sonner";

/** Muestra un toast según el resultado de una Server Action y devuelve r.ok. */
export function notificar(r: { ok: boolean; message: string }): boolean {
  if (r.message) {
    if (r.ok) toast.success(r.message);
    else toast.error(r.message);
  }
  return r.ok;
}
