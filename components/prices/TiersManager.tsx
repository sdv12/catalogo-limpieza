"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Star, Pencil, Trash2, Check, X } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { notificar } from "@/lib/ui";
import {
  crearTier,
  renombrarTier,
  toggleTier,
  fijarTierDefault,
  eliminarTier,
} from "@/app/panel/[catalogo]/precios/actions";

export type Tier = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  is_default: boolean;
};

export function TiersManager({
  slug,
  tiers,
  soloLectura,
}: {
  slug: string;
  tiers: Tier[];
  soloLectura: boolean;
}) {
  const router = useRouter();
  const [nuevo, setNuevo] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [aEliminar, setAEliminar] = useState<Tier | null>(null);

  const correr = async (fn: () => Promise<{ ok: boolean; message: string }>) => {
    const r = await fn();
    notificar(r);
    if (r.ok) router.refresh();
    return r;
  };

  return (
    <Card>
      <CardBody className="space-y-3">
        <h2 className="text-sm font-semibold text-texto">Niveles de precio</h2>

        <ul className="divide-y divide-linea rounded-comp-sm border border-linea">
          {tiers.map((t) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              {editId === t.id ? (
                <>
                  <Input
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    className="h-8 flex-1"
                    autoFocus
                  />
                  <button
                    onClick={() =>
                      correr(() => renombrarTier(slug, t.id, editVal)).then(() =>
                        setEditId(null),
                      )
                    }
                    className="rounded-comp-sm p-1.5 text-exito hover:bg-exito-suave"
                    aria-label="Guardar"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="rounded-comp-sm p-1.5 text-texto-sec hover:bg-superficie-sec"
                    aria-label="Cancelar"
                  >
                    <X size={15} />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-texto">
                    {t.name}
                    <code className="ml-2 text-xs text-texto-tenue">{t.code}</code>
                    {t.is_default && (
                      <Badge tono="primario" className="ml-2">
                        Por defecto
                      </Badge>
                    )}
                    {!t.is_active && (
                      <Badge tono="alerta" className="ml-2">
                        Inactivo
                      </Badge>
                    )}
                  </span>
                  {!soloLectura && (
                    <>
                      {!t.is_default && t.is_active && (
                        <button
                          onClick={() => correr(() => fijarTierDefault(slug, t.id))}
                          className="rounded-comp-sm p-1.5 text-texto-sec hover:bg-superficie-sec"
                          title="Marcar como nivel por defecto"
                        >
                          <Star size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditId(t.id);
                          setEditVal(t.name);
                        }}
                        className="rounded-comp-sm p-1.5 text-texto-sec hover:bg-superficie-sec"
                        aria-label="Renombrar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => correr(() => toggleTier(slug, t.id, !t.is_active))}
                        className="rounded-comp-sm px-1.5 py-1 text-xs text-texto-sec hover:bg-superficie-sec"
                      >
                        {t.is_active ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        onClick={() => setAEliminar(t)}
                        className="rounded-comp-sm p-1.5 text-texto-sec hover:bg-error-suave hover:text-error"
                        aria-label="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>

        {!soloLectura && (
          <div className="flex gap-2">
            <Input
              placeholder="Nuevo nivel (ej: Consumidor final)"
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                nuevo.trim().length >= 2 &&
                correr(() => crearTier(slug, nuevo)).then(() => setNuevo(""))
              }
              className="flex-1"
            />
            <Button
              onClick={() =>
                correr(() => crearTier(slug, nuevo)).then((r) => r.ok && setNuevo(""))
              }
              disabled={nuevo.trim().length < 2}
            >
              <Plus size={16} /> Agregar
            </Button>
          </div>
        )}
      </CardBody>

      <ConfirmDialog
        abierto={!!aEliminar}
        onCerrar={() => setAEliminar(null)}
        titulo="Eliminar nivel de precio"
        mensaje={
          <>
            ¿Eliminar <strong>{aEliminar?.name}</strong>? Solo se puede si ningún
            producto tiene precio en este nivel.
          </>
        }
        textoConfirmar="Eliminar"
        peligro
        onConfirmar={async () => {
          if (aEliminar) await correr(() => eliminarTier(slug, aEliminar.id));
        }}
      />
    </Card>
  );
}
