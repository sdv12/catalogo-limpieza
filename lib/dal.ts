import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type {
  RolCatalogo,
  RolEfectivo,
  CatalogoAccesible,
  PermisoCatalogo,
} from "@/lib/roles";
export {
  ETIQUETA_ROL,
  puedeEditar,
  esAdminCatalogo,
  puedeEditarPrecios,
  tienePermiso,
  PERMISOS_CATALOGO,
  ETIQUETA_PERMISO,
  DESCRIPCION_PERMISO,
} from "@/lib/roles";

import type { RolCatalogo, CatalogoAccesible, PermisoCatalogo } from "@/lib/roles";

export type Perfil = {
  id: string;
  email: string | null;
  full_name: string | null;
  is_superadmin: boolean;
  is_active: boolean;
};

/**
 * Verifica que haya sesión válida. Memoizada por render.
 * Redirige a /login si no hay usuario autenticado.
 */
export const verificarSesion = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  return { userId: user.id, email: user.email ?? null };
});

/**
 * Perfil del usuario actual. Redirige a /login si no hay sesión o está inactivo.
 */
export const obtenerPerfil = cache(async (): Promise<Perfil> => {
  const { userId } = await verificarSesion();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, is_superadmin, is_active")
    .eq("id", userId)
    .single<Perfil>();

  if (error || !data || !data.is_active) redirect("/login?error=sin-acceso");
  return data;
});

/** Exige que el usuario sea superadmin; si no, 404 (no revela la ruta). */
export const exigirSuperadmin = cache(async (): Promise<Perfil> => {
  const perfil = await obtenerPerfil();
  if (!perfil.is_superadmin) notFound();
  return perfil;
});

/**
 * Catálogos a los que el usuario tiene acceso (para el selector).
 * Superadmin → todos los activos. Resto → los de `catalog_members`.
 */
type FilaCatalogo = {
  id: string;
  slug: string;
  name: string;
  logo_path: string | null;
  is_active: boolean;
};

export const catalogosDelUsuario = cache(async (): Promise<CatalogoAccesible[]> => {
  const perfil = await obtenerPerfil();
  const supabase = await createClient();

  if (perfil.is_superadmin) {
    const { data } = await supabase
      .from("catalogs")
      .select("id, slug, name, logo_path, is_active")
      .order("name");
    return ((data ?? []) as unknown as FilaCatalogo[])
      .filter((c) => c.is_active)
      .map((c) => ({ ...c, rol: "superadmin" as const, permisos: [] }));
  }

  const { data: membresias } = await supabase
    .from("catalog_members")
    .select("catalog_id, role, permissions")
    .eq("user_id", perfil.id);

  const filas = (membresias ?? []) as unknown as {
    catalog_id: string;
    role: RolCatalogo;
    permissions: PermisoCatalogo[];
  }[];
  if (filas.length === 0) return [];

  const membresiaPorCatalogo = new Map(filas.map((f) => [f.catalog_id, f]));
  const { data: cats } = await supabase
    .from("catalogs")
    .select("id, slug, name, logo_path, is_active")
    .in("id", [...membresiaPorCatalogo.keys()]);

  return ((cats ?? []) as unknown as FilaCatalogo[])
    .filter((c) => c.is_active)
    .map((c) => {
      const m = membresiaPorCatalogo.get(c.id)!;
      return { ...c, rol: m.role, permisos: m.permissions ?? [] };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
});

/**
 * Resuelve un slug de catálogo y valida acceso.
 * 404 si no existe; 404 si el usuario no tiene acceso (RLS + este chequeo).
 */
export const resolverCatalogo = cache(
  async (slug: string): Promise<CatalogoAccesible> => {
    const catalogos = await catalogosDelUsuario();
    const catalogo = catalogos.find((c) => c.slug === slug);
    if (!catalogo) notFound();
    return catalogo;
  },
);

