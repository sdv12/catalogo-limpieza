"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirSuperadmin } from "@/lib/dal";
import { generarSlug } from "@/lib/format";

type Resultado = { ok: boolean; message: string; extra?: Record<string, string> };

const catalogoSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "El slug solo admite minúsculas, números y guiones")
    .optional(),
});

export async function crearCatalogo(
  _prev: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  await exigirSuperadmin();
  const parsed = catalogoSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const slug = generarSlug(parsed.data.slug || parsed.data.name);
  if (!slug) return { ok: false, message: "No se pudo generar el slug" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("catalogs")
    .insert({ name: parsed.data.name, slug });

  if (error) {
    return {
      ok: false,
      message: /duplicate|unique/i.test(error.message)
        ? `Ya existe un catálogo con el slug "${slug}"`
        : error.message,
    };
  }
  revalidatePath("/panel");
  revalidatePath("/panel/catalogos");
  return { ok: true, message: `Catálogo "${parsed.data.name}" creado` };
}

export async function actualizarCatalogo(
  id: string,
  data: { name?: string; is_active?: boolean; logo_path?: string | null },
): Promise<Resultado> {
  await exigirSuperadmin();
  const supabase = await createClient();
  const patch: {
    name?: string;
    is_active?: boolean;
    logo_path?: string | null;
  } = {};
  if (typeof data.name === "string") {
    const name = data.name.trim();
    if (name.length < 2) return { ok: false, message: "Nombre muy corto" };
    patch.name = name;
  }
  if (typeof data.is_active === "boolean") patch.is_active = data.is_active;
  if (data.logo_path !== undefined) patch.logo_path = data.logo_path;

  const { error } = await supabase.from("catalogs").update(patch).eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/panel");
  revalidatePath("/panel/catalogos");
  return { ok: true, message: "Catálogo actualizado" };
}

const miembroSchema = z.object({
  catalogId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  role: z.enum(["editor", "viewer"]),
  crearUsuario: z.boolean().default(false),
  fullName: z.string().trim().optional(),
});

export async function agregarMiembro(
  _prev: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  await exigirSuperadmin();
  const parsed = miembroSchema.safeParse({
    catalogId: formData.get("catalogId"),
    email: formData.get("email"),
    role: formData.get("role"),
    crearUsuario: formData.get("crearUsuario") === "on",
    fullName: formData.get("fullName") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const { catalogId, email, role, crearUsuario, fullName } = parsed.data;

  const supabase = await createClient();
  let extra: Record<string, string> | undefined;

  // Buscar el perfil por email
  let { data: perfil } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (!perfil) {
    if (!crearUsuario) {
      return {
        ok: false,
        message:
          "No hay ningún usuario con ese email. Marcá «crear usuario» para darlo de alta.",
      };
    }
    const admin = createAdminClient();
    const password = "Cat" + randomBytes(5).toString("hex") + "!7";
    const { data: creado, error: eCrear } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });
    if (eCrear || !creado.user) {
      return { ok: false, message: eCrear?.message || "No se pudo crear el usuario" };
    }
    // esperar al trigger handle_new_user
    for (let i = 0; i < 5 && !perfil; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", creado.user.id)
        .maybeSingle();
      perfil = data;
    }
    if (fullName) {
      await admin.from("profiles").update({ full_name: fullName }).eq("id", creado.user.id);
    }
    perfil = perfil ?? { id: creado.user.id };
    extra = { password, email };
  } else if (fullName) {
    // Perfil existente sin nombre → completarlo
    await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", perfil.id)
      .or("full_name.is.null,full_name.eq.");
  }

  const { error } = await supabase
    .from("catalog_members")
    .upsert({ catalog_id: catalogId, user_id: perfil.id, role })
    .select();

  if (error) return { ok: false, message: error.message };

  revalidatePath("/panel/catalogos");
  return {
    ok: true,
    message: extra
      ? `Usuario creado y agregado al catálogo.`
      : "Usuario agregado al catálogo",
    extra,
  };
}

export async function cambiarRolMiembro(
  catalogId: string,
  userId: string,
  role: "editor" | "viewer",
): Promise<Resultado> {
  await exigirSuperadmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("catalog_members")
    .update({ role })
    .eq("catalog_id", catalogId)
    .eq("user_id", userId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/panel/catalogos");
  return { ok: true, message: "Rol actualizado" };
}

export async function quitarMiembro(
  catalogId: string,
  userId: string,
): Promise<Resultado> {
  await exigirSuperadmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("catalog_members")
    .delete()
    .eq("catalog_id", catalogId)
    .eq("user_id", userId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/panel/catalogos");
  return { ok: true, message: "Usuario quitado del catálogo" };
}
