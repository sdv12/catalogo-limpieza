import "server-only";
import { createHash } from "node:crypto";

/** Las claves de canal se guardan solo como hash SHA-256. */
export function hashClave(clave: string): string {
  return createHash("sha256").update(clave).digest("hex");
}
