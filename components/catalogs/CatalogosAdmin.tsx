"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Store, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { notificar } from "@/lib/ui";
import {
  crearCatalogo,
  actualizarCatalogo,
  agregarMiembro,
  cambiarRolMiembro,
  quitarMiembro,
} from "@/app/panel/catalogos/actions";
import type { MiembroVista } from "@/app/panel/catalogos/page";

type Catalogo = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
};

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando…" : children}
    </Button>
  );
}

export function CatalogosAdmin({
  catalogos,
  miembrosPorCatalogo,
  superadmins,
}: {
  catalogos: Catalogo[];
  miembrosPorCatalogo: Record<string, MiembroVista[]>;
  superadmins: string[];
}) {
  const router = useRouter();
  const [nuevo, accionNuevo] = useActionState(crearCatalogo, null);

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <h2 className="text-sm font-semibold text-texto">Nuevo catálogo</h2>
          <form
            action={accionNuevo}
            className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <Label htmlFor="name" requerido>
                Nombre
              </Label>
              <Input id="name" name="name" placeholder="Catálogo Aura" required />
            </div>
            <div className="flex-1">
              <Label htmlFor="slug">Slug (opcional)</Label>
              <Input id="slug" name="slug" placeholder="aura" />
            </div>
            <SubmitButton>Crear</SubmitButton>
          </form>
          {nuevo && (
            <p
              className={`mt-2 text-xs ${nuevo.ok ? "text-exito" : "text-error"}`}
              aria-live="polite"
            >
              {nuevo.message}
            </p>
          )}
        </CardBody>
      </Card>

      <div className="space-y-3">
        {catalogos.map((c) => (
          <CatalogoRow
            key={c.id}
            catalogo={c}
            miembros={miembrosPorCatalogo[c.id] ?? []}
            superadmins={superadmins}
            onCambio={() => router.refresh()}
          />
        ))}
      </div>
    </div>
  );
}

function CatalogoRow({
  catalogo,
  miembros,
  superadmins,
  onCambio,
}: {
  catalogo: Catalogo;
  miembros: MiembroVista[];
  superadmins: string[];
  onCambio: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(catalogo.name);
  const [guardando, setGuardando] = useState(false);
  const [miembroAQuitar, setMiembroAQuitar] = useState<MiembroVista | null>(null);
  const [agregar, accionAgregar] = useActionState(agregarMiembro, null);

  async function guardarNombre() {
    if (nombre.trim() === catalogo.name) return;
    setGuardando(true);
    const r = await actualizarCatalogo(catalogo.id, { name: nombre });
    setGuardando(false);
    notificar(r);
    if (r.ok) onCambio();
  }

  async function toggleActivo() {
    const r = await actualizarCatalogo(catalogo.id, {
      is_active: !catalogo.is_active,
    });
    notificar(r);
    if (r.ok) onCambio();
  }

  return (
    <Card>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <Store size={18} className="text-primario" />
        <span className="font-medium text-texto">{catalogo.name}</span>
        <code className="text-xs text-texto-tenue">/{catalogo.slug}</code>
        {!catalogo.is_active && <Badge tono="alerta">Inactivo</Badge>}
        <span className="ml-auto text-xs text-texto-tenue">
          {miembros.length} {miembros.length === 1 ? "usuario" : "usuarios"}
        </span>
      </button>

      {abierto && (
        <CardBody className="border-t border-linea">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor={`n-${catalogo.id}`}>Nombre</Label>
              <Input
                id={`n-${catalogo.id}`}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <Button
              variante="secundario"
              onClick={guardarNombre}
              disabled={guardando || nombre.trim() === catalogo.name}
            >
              Guardar
            </Button>
            <Button
              variante={catalogo.is_active ? "peligro" : "primario"}
              onClick={toggleActivo}
            >
              {catalogo.is_active ? "Desactivar" : "Activar"}
            </Button>
          </div>

          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-texto-sec">
              Usuarios del catálogo
            </h3>

            <ul className="mt-2 divide-y divide-linea rounded-comp-sm border border-linea">
              {miembros.length === 0 && (
                <li className="px-3 py-2 text-sm text-texto-tenue">
                  Sin usuarios asignados.
                </li>
              )}
              {miembros.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center gap-2 px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-texto">
                      {m.full_name || m.email || m.user_id.slice(0, 8)}
                    </span>
                    {m.full_name && m.email && (
                      <span className="truncate text-xs text-texto-tenue">
                        {m.email}
                      </span>
                    )}
                  </span>
                  <Select
                    value={m.role}
                    onChange={async (e) => {
                      const r = await cambiarRolMiembro(
                        catalogo.id,
                        m.user_id,
                        e.target.value as "editor" | "viewer",
                      );
                      notificar(r);
                      if (r.ok) onCambio();
                    }}
                    className="h-8 w-32 shrink-0"
                  >
                    <option value="editor">Edición</option>
                    <option value="viewer">Solo lectura</option>
                  </Select>
                  <button
                    type="button"
                    onClick={() => setMiembroAQuitar(m)}
                    className="shrink-0 rounded-comp-sm p-1.5 text-texto-sec hover:bg-error-suave hover:text-error"
                    aria-label="Quitar"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>

            {superadmins.length > 0 && (
              <p className="mt-2 text-xs text-texto-tenue">
                Superadmins (acceso a todo): {superadmins.join(", ")}
              </p>
            )}

            <form
              action={accionAgregar}
              className="mt-4 rounded-comp-sm border border-linea bg-superficie-sec p-3"
            >
              <input type="hidden" name="catalogId" value={catalogo.id} />
              <p className="text-xs font-semibold uppercase tracking-wide text-texto-sec">
                Agregar usuario
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Label htmlFor={`e-${catalogo.id}`}>Email</Label>
                  <Input
                    id={`e-${catalogo.id}`}
                    name="email"
                    type="email"
                    required
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor={`fn-${catalogo.id}`}>Nombre (opcional)</Label>
                  <Input id={`fn-${catalogo.id}`} name="fullName" />
                </div>
                <div>
                  <Label htmlFor={`r-${catalogo.id}`}>Rol</Label>
                  <Select
                    id={`r-${catalogo.id}`}
                    name="role"
                    defaultValue="editor"
                    className="w-full sm:w-32"
                  >
                    <option value="editor">Edición</option>
                    <option value="viewer">Solo lectura</option>
                  </Select>
                </div>
                <SubmitButton>Agregar</SubmitButton>
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-texto-sec">
                <input type="checkbox" name="crearUsuario" />
                Crear el usuario si no existe (se genera una contraseña temporal)
              </label>
              {agregar && (
                <div className="mt-2 text-xs" aria-live="polite">
                  <p className={agregar.ok ? "text-exito" : "text-error"}>
                    {agregar.message}
                  </p>
                  {agregar.extra?.password && (
                    <p className="mt-1 rounded bg-alerta-suave px-2 py-1 text-alerta">
                      Contraseña temporal de {agregar.extra.email}:{" "}
                      <code className="font-semibold">
                        {agregar.extra.password}
                      </code>{" "}
                      — anotala, no se vuelve a mostrar.
                    </p>
                  )}
                </div>
              )}
            </form>
          </div>
        </CardBody>
      )}

      <ConfirmDialog
        abierto={!!miembroAQuitar}
        onCerrar={() => setMiembroAQuitar(null)}
        titulo="Quitar usuario"
        mensaje={
          <>
            ¿Quitar a <strong>{miembroAQuitar?.email}</strong> del catálogo{" "}
            <strong>{catalogo.name}</strong>? Perderá el acceso.
          </>
        }
        textoConfirmar="Quitar"
        peligro
        onConfirmar={async () => {
          if (!miembroAQuitar) return;
          const r = await quitarMiembro(catalogo.id, miembroAQuitar.user_id);
          notificar(r);
          if (r.ok) onCambio();
        }}
      />
    </Card>
  );
}
