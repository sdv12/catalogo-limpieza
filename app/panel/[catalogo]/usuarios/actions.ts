"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirAdmin, type ResultadoAccion } from "@/lib/guards";

function rev(slug: string) {
  revalidatePath(`/panel/${slug}/usuarios`);
}

const ROLES = ["admin", "empleado", "viewer"] as const;
type Rol = (typeof ROLES)[number];

/** Impide dejar el catálogo sin ningún administrador. */
async function esUltimoAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  catalogId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("catalog_members")
    .select("user_id")
    .eq("catalog_id", catalogId)
    .eq("role", "admin");
  const admins = data ?? [];
  return admins.length === 1 && admins[0].user_id === userId;
}

const miembroSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  fullName: z.string().trim().optional(),
  role: z.enum(ROLES),
  crearUsuario: z.boolean().default(false),
});

export async function agregarMiembroCatalogo(
  slug: string,
  input: {
    email: string;
    fullName?: string;
    role: Rol;
    crearUsuario: boolean;
  },
): Promise<ResultadoAccion & { extra?: { password: string; email: string } }> {
  const catalogo = await exigirAdmin(slug);
  const parsed = miembroSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const { email, role, crearUsuario, fullName } = parsed.data;

  const supabase = await createClient();
  let extra: { password: string; email: string } | undefined;

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
    await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", perfil.id)
      .or("full_name.is.null,full_name.eq.");
  }

  const { error } = await supabase
    .from("catalog_members")
    .upsert({ catalog_id: catalogo.id, user_id: perfil.id, role });

  if (error) return { ok: false, message: error.message };

  rev(slug);
  return {
    ok: true,
    message: extra ? "Usuario creado y agregado al catálogo." : "Usuario agregado",
    extra,
  };
}

export async function cambiarRolMiembroCatalogo(
  slug: string,
  userId: string,
  role: Rol,
): Promise<ResultadoAccion> {
  const catalogo = await exigirAdmin(slug);
  const supabase = await createClient();

  if (role !== "admin" && (await esUltimoAdmin(supabase, catalogo.id, userId))) {
    return {
      ok: false,
      message:
        "Es el único administrador del catálogo. Asigná otro admin antes de cambiarle el rol.",
    };
  }

  const { error } = await supabase
    .from("catalog_members")
    .update({ role })
    .eq("catalog_id", catalogo.id)
    .eq("user_id", userId);
  if (error) return { ok: false, message: error.message };
  rev(slug);
  return { ok: true, message: "Rol actualizado" };
}

export async function quitarMiembroCatalogo(
  slug: string,
  userId: string,
): Promise<ResultadoAccion> {
  const catalogo = await exigirAdmin(slug);
  const supabase = await createClient();

  if (await esUltimoAdmin(supabase, catalogo.id, userId)) {
    return {
      ok: false,
      message:
        "Es el único administrador del catálogo. Asigná otro admin antes de sacarlo.",
    };
  }

  const { error } = await supabase
    .from("catalog_members")
    .delete()
    .eq("catalog_id", catalogo.id)
    .eq("user_id", userId);
  if (error) return { ok: false, message: error.message };
  rev(slug);
  return { ok: true, message: "Usuario quitado del catálogo" };
}
