/**
 * Motor de ARAU: busca el tema que mejor responde una pregunta por palabras
 * clave. Sin IA: normaliza el texto (minúsculas, sin tildes ni signos) y
 * puntúa cada tema según cuántas de sus claves aparecen.
 */
import { TEMAS, type Tema, type Requisito } from "@/lib/arau/temas";
import {
  ETIQUETA_PERMISO,
  type RolEfectivo,
  type PermisoCatalogo,
} from "@/lib/roles";

/** Palabras que no aportan para buscar. */
const VACIAS = new Set(
  "a al algo como con cual cuando de del donde el en es esta este hacer hago la las le lo los me mi necesito no o para por puedo que quiero se si su sus te tengo un una uno y ya hola buenas gracias favor ayuda ayudame arau".split(" "),
);

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ_\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function palabras(texto: string): string[] {
  return normalizar(texto)
    .split(" ")
    .filter((p) => p.length > 1 && !VACIAS.has(p));
}

/** Raíz simple para que "productos" matchee "producto", "precios" → "precio", etc. */
function raiz(p: string): string {
  if (p.length > 5 && p.endsWith("es")) return p.slice(0, -2);
  if (p.length > 4 && p.endsWith("s")) return p.slice(0, -1);
  return p;
}

export function puntuar(tema: Tema, pregunta: string): number {
  const texto = ` ${normalizar(pregunta)} `;
  const raices = new Set(palabras(pregunta).map(raiz));
  let puntos = 0;

  for (const clave of tema.claves) {
    const c = normalizar(clave);
    if (c.includes(" ")) {
      // Frase exacta: vale mucho. Si no está entera, cuenta lo que coincida.
      if (texto.includes(` ${c} `)) puntos += 3 + c.split(" ").length;
      else {
        const partes = palabras(c).map(raiz);
        const hits = partes.filter((p) => raices.has(p)).length;
        if (partes.length > 0 && hits === partes.length) puntos += 2 + hits;
      }
    } else if (raices.has(raiz(c))) {
      puntos += 2;
    }
  }

  // El título también suma un poco (desempata).
  for (const p of palabras(tema.titulo)) if (raices.has(raiz(p))) puntos += 0.5;
  return puntos;
}

const MINIMO = 2;

export type Resultado = { tema: Tema; puntos: number };

/** Temas ordenados del más al menos relevante (solo los que superan el mínimo). */
export function buscarTemas(pregunta: string, max = 4): Resultado[] {
  return TEMAS.map((tema) => ({ tema, puntos: puntuar(tema, pregunta) }))
    .filter((r) => r.puntos >= MINIMO)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, max);
}

/** ¿El usuario cumple el requisito del tema? */
export function cumple(
  requisito: Requisito | undefined,
  rol: RolEfectivo,
  permisos: PermisoCatalogo[],
): boolean {
  if (!requisito) return true;
  const admin = rol === "superadmin" || rol === "admin";
  if (requisito === "superadmin") return rol === "superadmin";
  if (requisito === "admin") return admin;
  if (requisito === "editar") return admin || rol === "empleado";
  return admin || (rol === "empleado" && permisos.includes(requisito));
}

/** Aviso que se antepone a la respuesta si el usuario no puede hacerlo. */
export function avisoPermiso(requisito: Requisito): string {
  switch (requisito) {
    case "superadmin":
      return "Ojo: esto lo puede hacer solo el administrador general.";
    case "admin":
      return "Ojo: esto lo puede hacer solo un administrador del catálogo.";
    case "editar":
      return "Ojo: tu usuario es de solo lectura, así que no vas a poder hacer este cambio. Pedíselo a un administrador o a un empleado.";
    default:
      return `Ojo: para esto necesitás el permiso "${ETIQUETA_PERMISO[requisito]}". Pedile a un administrador que te lo prenda en "Usuarios".`;
  }
}
