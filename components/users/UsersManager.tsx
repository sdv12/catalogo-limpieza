"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Plus, Trash2, ShieldCheck } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { notificar } from "@/lib/ui";
import { ETIQUETA_ROL, type RolCatalogo } from "@/lib/roles";
import {
  agregarMiembroCatalogo,
  cambiarRolMiembroCatalogo,
  quitarMiembroCatalogo,
} from "@/app/panel/[catalogo]/usuarios/actions";

export type MiembroCatalogo = {
  user_id: string;
  role: RolCatalogo;
  email: string | null;
  full_name: string | null;
};

const DESCRIPCION_ROL: Record<RolCatalogo, string> = {
  admin:
    "Control total: precios, niveles, carga masiva, promos, costos y proveedores, cuenta corriente, y gestiona quién tiene acceso.",
  empleado:
    "Carga y edita productos, ajusta stock, gestiona clientes y proveedores, registra pagos. No ve costos/proveedores en el listado ni toca precios existentes.",
  viewer: "Solo consulta: ve el catálogo pero no puede cambiar nada.",
};

const ROLES: RolCatalogo[] = ["admin", "empleado", "viewer"];

export function UsersManager({
  slug,
  miembros,
  miUserId,
}: {
  slug: string;
  miembros: MiembroCatalogo[];
  miUserId: string | null;
}) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<RolCatalogo>("empleado");
  const [crearUsuario, setCrearUsuario] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{
    ok: boolean;
    message: string;
    extra?: { password: string; email: string };
  } | null>(null);

  const [confirmarAdmin, setConfirmarAdmin] = useState<{
    userId: string;
    label: string;
  } | null>(null);
  const [aQuitar, setAQuitar] = useState<MiembroCatalogo | null>(null);

  async function agregar() {
    if (!email.trim()) return notificar({ ok: false, message: "Ingresá un email" });
    setGuardando(true);
    const r = await agregarMiembroCatalogo(slug, {
      email: email.trim(),
      fullName: fullName.trim() || undefined,
      role,
      crearUsuario,
    });
    setGuardando(false);
    setResultado(r);
    notificar(r);
    if (r.ok) {
      setEmail("");
      setFullName("");
      setRole("empleado");
      setCrearUsuario(false);
      router.refresh();
    }
  }

  async function cambiarRol(m: MiembroCatalogo, nuevoRol: RolCatalogo) {
    if (nuevoRol === "admin" && m.role !== "admin") {
      setConfirmarAdmin({ userId: m.user_id, label: m.full_name || m.email || "este usuario" });
      return;
    }
    const r = await cambiarRolMiembroCatalogo(slug, m.user_id, nuevoRol);
    notificar(r);
    if (r.ok) router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="flex gap-2.5 text-sm text-texto-sec">
          <Info size={16} className="mt-0.5 shrink-0 text-texto-tenue" />
          <ul className="space-y-1">
            {ROLES.map((r) => (
              <li key={r}>
                <span className="font-medium text-texto">{ETIQUETA_ROL[r]}:</span>{" "}
                {DESCRIPCION_ROL[r]}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Miembros ({miembros.length})</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {miembros.length === 0 ? (
            <p className="text-sm text-texto-tenue">Todavía no hay usuarios asignados.</p>
          ) : (
            <ul className="divide-y divide-linea rounded-comp-sm border border-linea">
              {miembros.map((m) => (
                <li
                  key={m.user_id}
                  className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-texto">
                      {m.full_name || m.email || m.user_id.slice(0, 8)}
                      {m.user_id === miUserId && (
                        <span className="ml-1.5 text-xs font-normal text-texto-tenue">
                          (vos)
                        </span>
                      )}
                    </span>
                    {m.full_name && m.email && (
                      <span className="truncate text-xs text-texto-tenue">{m.email}</span>
                    )}
                  </span>
                  <Select
                    value={m.role}
                    onChange={(e) => cambiarRol(m, e.target.value as RolCatalogo)}
                    className="h-9 w-40 shrink-0"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ETIQUETA_ROL[r]}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    onClick={() => setAQuitar(m)}
                    className="shrink-0 rounded-comp-sm p-1.5 text-texto-sec hover:bg-error-suave hover:text-error"
                    aria-label="Quitar del catálogo"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agregar usuario</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label requerido>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label>Nombre (opcional)</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label>Rol</Label>
              <Select
                value={role}
                onChange={(e) => setRole(e.target.value as RolCatalogo)}
                className="w-full sm:w-40"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ETIQUETA_ROL[r]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <p className="text-xs text-texto-tenue">{DESCRIPCION_ROL[role]}</p>

          <label className="flex items-center gap-2 text-sm text-texto-sec">
            <input
              type="checkbox"
              checked={crearUsuario}
              onChange={(e) => setCrearUsuario(e.target.checked)}
            />
            Crear el usuario si no existe (se genera una contraseña temporal)
          </label>

          <div>
            <Button onClick={agregar} disabled={guardando}>
              <Plus size={15} />
              {guardando ? "Agregando…" : "Agregar"}
            </Button>
          </div>

          {resultado?.extra?.password && (
            <p className="rounded bg-alerta-suave px-3 py-2 text-xs text-alerta">
              Contraseña temporal de {resultado.extra.email}:{" "}
              <code className="font-semibold">{resultado.extra.password}</code> — anotala,
              no se vuelve a mostrar.
            </p>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        abierto={!!confirmarAdmin}
        onCerrar={() => setConfirmarAdmin(null)}
        titulo="Dar permisos de administrador"
        mensaje={
          <>
            <ShieldCheck size={15} className="mb-1 inline text-primario" />{" "}
            <strong>{confirmarAdmin?.label}</strong> va a tener control total del
            catálogo: precios, costos, proveedores, promos, cuenta corriente y gestión
            de otros usuarios. ¿Confirmás?
          </>
        }
        textoConfirmar="Dar permisos de admin"
        onConfirmar={async () => {
          if (!confirmarAdmin) return;
          const r = await cambiarRolMiembroCatalogo(slug, confirmarAdmin.userId, "admin");
          notificar(r);
          setConfirmarAdmin(null);
          if (r.ok) router.refresh();
        }}
      />

      <ConfirmDialog
        abierto={!!aQuitar}
        onCerrar={() => setAQuitar(null)}
        titulo="Quitar usuario"
        mensaje={
          <>
            ¿Quitar a <strong>{aQuitar?.full_name || aQuitar?.email}</strong> del
            catálogo? Pierde el acceso.
          </>
        }
        textoConfirmar="Quitar"
        peligro
        onConfirmar={async () => {
          if (!aQuitar) return;
          const r = await quitarMiembroCatalogo(slug, aQuitar.user_id);
          notificar(r);
          setAQuitar(null);
          if (r.ok) router.refresh();
        }}
      />
    </div>
  );
}
