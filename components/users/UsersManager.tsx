"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Plus, Trash2, ShieldCheck, Lock } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { notificar } from "@/lib/ui";
import {
  ETIQUETA_ROL,
  PERMISOS_CATALOGO,
  ETIQUETA_PERMISO,
  DESCRIPCION_PERMISO,
  type RolCatalogo,
  type PermisoCatalogo,
} from "@/lib/roles";
import {
  agregarMiembroCatalogo,
  cambiarRolMiembroCatalogo,
  actualizarPermisosMiembro,
  quitarMiembroCatalogo,
} from "@/app/panel/[catalogo]/usuarios/actions";

export type MiembroCatalogo = {
  user_id: string;
  role: RolCatalogo;
  permissions: PermisoCatalogo[];
  email: string | null;
  full_name: string | null;
};

const BASE_ROL: Record<RolCatalogo, string> = {
  admin: "Todo: precios, niveles, carga masiva, promos, costos y proveedores, cuenta corriente, y decide quién tiene acceso.",
  empleado:
    "Base fija: productos y stock, clientes y proveedores, cargar cargo/pago y editar el precio de un producto ya cargado. El resto se prende por permiso, abajo.",
  viewer: "Solo consulta: ve el catálogo pero no puede cambiar nada.",
};

const ROLES: RolCatalogo[] = ["admin", "empleado", "viewer"];

function Chips({
  seleccionados,
  onToggle,
  disabled,
}: {
  seleccionados: PermisoCatalogo[];
  onToggle: (p: PermisoCatalogo) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PERMISOS_CATALOGO.map((p) => {
        const on = seleccionados.includes(p);
        return (
          <button
            key={p}
            type="button"
            title={DESCRIPCION_PERMISO[p]}
            disabled={disabled}
            onClick={() => onToggle(p)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              on
                ? "border-primario bg-primario-suave text-primario-fuerte"
                : "border-linea text-texto-sec hover:bg-superficie-sec"
            }`}
          >
            {ETIQUETA_PERMISO[p]}
          </button>
        );
      })}
    </div>
  );
}

function FilaMiembro({
  slug,
  m,
  esVos,
  puedeTocar,
  onCambio,
  onQuitar,
}: {
  slug: string;
  m: MiembroCatalogo;
  esVos: boolean;
  puedeTocar: boolean;
  onCambio: () => void;
  onQuitar: () => void;
}) {
  const [confirmarAdmin, setConfirmarAdmin] = useState(false);

  async function cambiarRol(nuevoRol: RolCatalogo) {
    if (nuevoRol === "admin" && m.role !== "admin") {
      setConfirmarAdmin(true);
      return;
    }
    const r = await cambiarRolMiembroCatalogo(slug, m.user_id, nuevoRol);
    notificar(r);
    if (r.ok) onCambio();
  }

  async function togglePermiso(p: PermisoCatalogo) {
    const nuevos = m.permissions.includes(p)
      ? m.permissions.filter((x) => x !== p)
      : [...m.permissions, p];
    const r = await actualizarPermisosMiembro(slug, m.user_id, nuevos);
    notificar(r);
    if (r.ok) onCambio();
  }

  return (
    <li className="px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium text-texto">
            {m.full_name || m.email || m.user_id.slice(0, 8)}
            {esVos && (
              <span className="ml-1.5 text-xs font-normal text-texto-tenue">(vos)</span>
            )}
            {m.role === "admin" && !puedeTocar && (
              <Lock size={11} className="ml-1.5 inline text-texto-tenue" />
            )}
          </span>
          {m.full_name && m.email && (
            <span className="truncate text-xs text-texto-tenue">{m.email}</span>
          )}
        </span>
        <Select
          value={m.role}
          disabled={m.role === "admin" && !puedeTocar}
          onChange={(e) => cambiarRol(e.target.value as RolCatalogo)}
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
          disabled={m.role === "admin" && !puedeTocar}
          onClick={onQuitar}
          className="shrink-0 rounded-comp-sm p-1.5 text-texto-sec hover:bg-error-suave hover:text-error disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Quitar del catálogo"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {m.role === "empleado" && (
        <div className="mt-2 pl-0">
          <Chips
            seleccionados={m.permissions}
            onToggle={togglePermiso}
            disabled={!puedeTocar}
          />
        </div>
      )}

      <ConfirmDialog
        abierto={confirmarAdmin}
        onCerrar={() => setConfirmarAdmin(false)}
        titulo="Dar permisos de administrador"
        mensaje={
          <>
            <ShieldCheck size={15} className="mb-1 inline text-primario" />{" "}
            <strong>{m.full_name || m.email}</strong> va a tener control total del
            catálogo: precios, costos, proveedores, promos, cuenta corriente y gestión
            de otros usuarios. ¿Confirmás?
          </>
        }
        textoConfirmar="Dar permisos de admin"
        onConfirmar={async () => {
          const r = await cambiarRolMiembroCatalogo(slug, m.user_id, "admin");
          notificar(r);
          setConfirmarAdmin(false);
          if (r.ok) onCambio();
        }}
      />
    </li>
  );
}

export function UsersManager({
  slug,
  miembros,
  miUserId,
  esAdmin,
}: {
  slug: string;
  miembros: MiembroCatalogo[];
  miUserId: string | null;
  esAdmin: boolean;
}) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<RolCatalogo>("empleado");
  const [permisosNuevo, setPermisosNuevo] = useState<PermisoCatalogo[]>([]);
  const [crearUsuario, setCrearUsuario] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{
    ok: boolean;
    message: string;
    extra?: { password: string; email: string };
  } | null>(null);
  const [aQuitar, setAQuitar] = useState<MiembroCatalogo | null>(null);

  function actualizar() {
    router.refresh();
  }

  async function agregar() {
    if (!email.trim()) return notificar({ ok: false, message: "Ingresá un email" });
    setGuardando(true);
    const r = await agregarMiembroCatalogo(slug, {
      email: email.trim(),
      fullName: fullName.trim() || undefined,
      role,
      permissions: role === "empleado" ? permisosNuevo : undefined,
      crearUsuario,
    });
    setGuardando(false);
    setResultado(r);
    notificar(r);
    if (r.ok) {
      setEmail("");
      setFullName("");
      setRole("empleado");
      setPermisosNuevo([]);
      setCrearUsuario(false);
      actualizar();
    }
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
                {BASE_ROL[r]}
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
                <FilaMiembro
                  key={m.user_id}
                  slug={slug}
                  m={m}
                  esVos={m.user_id === miUserId}
                  puedeTocar={esAdmin || m.role !== "admin"}
                  onCambio={actualizar}
                  onQuitar={() => setAQuitar(m)}
                />
              ))}
            </ul>
          )}
          {!esAdmin && (
            <p className="flex items-center gap-1.5 text-xs text-texto-tenue">
              <Lock size={12} />
              Los administradores solo los gestiona otro administrador.
            </p>
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
                {ROLES.filter((r) => esAdmin || r !== "admin").map((r) => (
                  <option key={r} value={r}>
                    {ETIQUETA_ROL[r]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <p className="text-xs text-texto-tenue">{BASE_ROL[role]}</p>

          {role === "empleado" && (
            <div>
              <Label>Permisos extra (opcional)</Label>
              <div className="mt-1">
                <Chips
                  seleccionados={permisosNuevo}
                  onToggle={(p) =>
                    setPermisosNuevo((s) =>
                      s.includes(p) ? s.filter((x) => x !== p) : [...s, p],
                    )
                  }
                />
              </div>
            </div>
          )}

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
          if (r.ok) actualizar();
        }}
      />
    </div>
  );
}
