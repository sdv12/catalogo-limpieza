"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronUp, ChevronDown, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { notificar } from "@/lib/ui";
import type { CategoriaNodo } from "@/app/panel/[catalogo]/categorias/page";
import {
  crearCategoria,
  renombrarCategoria,
  toggleCategoria,
  moverCategoria,
  eliminarCategoria,
} from "@/app/panel/[catalogo]/categorias/actions";

export function CategoryManager({
  slug,
  raiz,
  soloLectura,
}: {
  slug: string;
  raiz: CategoriaNodo[];
  soloLectura: boolean;
}) {
  const router = useRouter();
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoPadre, setNuevoPadre] = useState("");
  const [creando, setCreando] = useState(false);

  const planas: { id: string; label: string }[] = [];
  const recorrer = (nodos: CategoriaNodo[], prefijo: string) => {
    for (const n of nodos) {
      planas.push({ id: n.id, label: prefijo + n.name });
      recorrer(n.hijos, prefijo + "— ");
    }
  };
  recorrer(raiz, "");

  async function crear() {
    if (nuevoNombre.trim().length < 2) return;
    setCreando(true);
    const r = await crearCategoria(slug, {
      name: nuevoNombre,
      parentId: nuevoPadre || null,
    });
    setCreando(false);
    if (r.ok) {
      toast.success(r.message);
      setNuevoNombre("");
      setNuevoPadre("");
      router.refresh();
    } else {
      toast.error(r.message);
    }
  }

  return (
    <div className="space-y-5">
      {!soloLectura && (
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold text-texto">Nueva categoría</h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Nombre de la categoría"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && crear()}
                className="flex-1"
              />
              <Select
                value={nuevoPadre}
                onChange={(e) => setNuevoPadre(e.target.value)}
                className="sm:w-64"
              >
                <option value="">Categoría raíz</option>
                {planas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
              <Button onClick={crear} disabled={creando}>
                <Plus size={16} />
                Agregar
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {raiz.length === 0 ? (
        <p className="text-sm text-texto-tenue">Todavía no hay categorías.</p>
      ) : (
        <ul className="space-y-1">
          {raiz.map((n, i) => (
            <Nodo
              key={n.id}
              slug={slug}
              nodo={n}
              nivel={0}
              esPrimero={i === 0}
              esUltimo={i === raiz.length - 1}
              soloLectura={soloLectura}
              onCambio={() => router.refresh()}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Nodo({
  slug,
  nodo,
  nivel,
  esPrimero,
  esUltimo,
  soloLectura,
  onCambio,
}: {
  slug: string;
  nodo: CategoriaNodo;
  nivel: number;
  esPrimero: boolean;
  esUltimo: boolean;
  soloLectura: boolean;
  onCambio: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(nodo.name);
  const [aEliminar, setAEliminar] = useState(false);

  async function accion(fn: () => Promise<{ ok: boolean; message: string }>) {
    const r = await fn();
    notificar(r);
    if (r.ok) onCambio();
  }

  return (
    <li>
      <div
        className="flex items-center gap-2 rounded-comp-sm border border-linea bg-superficie px-3 py-2"
        style={{ marginLeft: nivel * 20 }}
      >
        {editando ? (
          <>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="h-8 flex-1"
              autoFocus
            />
            <button
              onClick={() =>
                accion(() => renombrarCategoria(slug, nodo.id, nombre)).then(() =>
                  setEditando(false),
                )
              }
              className="rounded-comp-sm p-1.5 text-exito hover:bg-exito-suave"
              aria-label="Guardar"
            >
              <Check size={15} />
            </button>
            <button
              onClick={() => {
                setNombre(nodo.name);
                setEditando(false);
              }}
              className="rounded-comp-sm p-1.5 text-texto-sec hover:bg-superficie-sec"
              aria-label="Cancelar"
            >
              <X size={15} />
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-sm text-texto">
              {nodo.name}
              {!nodo.is_active && (
                <Badge tono="alerta" className="ml-2">
                  Inactiva
                </Badge>
              )}
            </span>
            <span className="text-xs text-texto-tenue">
              {nodo.productos} prod.
            </span>
            {!soloLectura && (
              <>
                <button
                  disabled={esPrimero}
                  onClick={() => accion(() => moverCategoria(slug, nodo.id, "arriba"))}
                  className="rounded-comp-sm p-1 text-texto-sec hover:bg-superficie-sec disabled:opacity-30"
                  aria-label="Subir"
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  disabled={esUltimo}
                  onClick={() => accion(() => moverCategoria(slug, nodo.id, "abajo"))}
                  className="rounded-comp-sm p-1 text-texto-sec hover:bg-superficie-sec disabled:opacity-30"
                  aria-label="Bajar"
                >
                  <ChevronDown size={15} />
                </button>
                <button
                  onClick={() => setEditando(true)}
                  className="rounded-comp-sm p-1.5 text-texto-sec hover:bg-superficie-sec"
                  aria-label="Renombrar"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() =>
                    accion(() => toggleCategoria(slug, nodo.id, !nodo.is_active))
                  }
                  className="rounded-comp-sm px-1.5 py-1 text-xs text-texto-sec hover:bg-superficie-sec"
                >
                  {nodo.is_active ? "Desactivar" : "Activar"}
                </button>
                <button
                  onClick={() => setAEliminar(true)}
                  className="rounded-comp-sm p-1.5 text-texto-sec hover:bg-error-suave hover:text-error"
                  aria-label="Eliminar"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </>
        )}
      </div>

      {nodo.hijos.length > 0 && (
        <ul className="mt-1 space-y-1">
          {nodo.hijos.map((h, i) => (
            <Nodo
              key={h.id}
              slug={slug}
              nodo={h}
              nivel={nivel + 1}
              esPrimero={i === 0}
              esUltimo={i === nodo.hijos.length - 1}
              soloLectura={soloLectura}
              onCambio={onCambio}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        abierto={aEliminar}
        onCerrar={() => setAEliminar(false)}
        titulo="Eliminar categoría"
        mensaje={
          <>
            ¿Eliminar <strong>{nodo.name}</strong>? Solo se puede si no tiene
            productos ni subcategorías.
          </>
        }
        textoConfirmar="Eliminar"
        peligro
        onConfirmar={() => accion(() => eliminarCategoria(slug, nodo.id))}
      />
    </li>
  );
}
