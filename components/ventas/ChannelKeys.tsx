"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { notificar } from "@/lib/ui";
import { formatearFechaHora } from "@/lib/format";
import { CANALES_EXTERNOS, ETIQUETA_CANAL, type CanalExterno } from "@/lib/ventas";
import {
  activarClaveCanal,
  crearClaveCanal,
  eliminarClaveCanal,
} from "@/app/panel/[catalogo]/ventas/actions";

export type ClaveFila = {
  id: string;
  channel: CanalExterno;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
};

export function ChannelKeys({ slug, claves }: { slug: string; claves: ClaveFila[] }) {
  const router = useRouter();
  const [canal, setCanal] = useState<CanalExterno>("tienda");
  const [nombre, setNombre] = useState("");
  const [nueva, setNueva] = useState<string | null>(null);
  const [aBorrar, setABorrar] = useState<ClaveFila | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function crear() {
    setOcupado(true);
    const r = await crearClaveCanal(slug, canal, nombre);
    setOcupado(false);
    if (notificar(r)) {
      setNueva((r.data as { clave: string }).clave);
      setNombre("");
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Claves de canales</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {nueva && (
          <div className="space-y-2 rounded-comp-sm border border-alerta bg-alerta-suave p-3 text-sm">
            <p className="font-medium text-texto">
              Copiá la clave ahora: por seguridad no se vuelve a mostrar.
            </p>
            <div className="flex gap-2">
              <code className="min-w-0 flex-1 truncate rounded-comp-sm bg-superficie px-2 py-1.5 font-mono text-xs">
                {nueva}
              </code>
              <Button
                tamano="sm"
                variante="secundario"
                onClick={() => {
                  navigator.clipboard.writeText(nueva);
                  notificar({ ok: true, message: "Clave copiada" });
                }}
              >
                <Copy size={14} />
                Copiar
              </Button>
            </div>
            <button type="button" onClick={() => setNueva(null)} className="text-xs text-texto-sec hover:underline">
              Ya la guardé
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="sm:w-40">
            <Label>Canal</Label>
            <Select value={canal} onChange={(e) => setCanal(e.target.value as CanalExterno)}>
              {CANALES_EXTERNOS.map((c) => (
                <option key={c} value={c}>
                  {ETIQUETA_CANAL[c]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <Label>Nombre</Label>
            <Input
              value={nombre}
              maxLength={60}
              onChange={(e) => setNombre(e.target.value)}
              placeholder='Ej: "Tienda Aura", "Bot WhatsApp"'
            />
          </div>
          <Button onClick={crear} disabled={ocupado || nombre.trim().length < 2}>
            <Plus size={15} />
            Crear clave
          </Button>
        </div>

        {claves.length === 0 ? (
          <p className="text-sm text-texto-tenue">Todavía no hay claves.</p>
        ) : (
          <ul className="divide-y divide-linea">
            {claves.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium text-texto">
                    {k.name}
                    <Badge tono={k.is_active ? "exito" : "neutro"}>
                      {k.is_active ? "Activa" : "Desactivada"}
                    </Badge>
                  </p>
                  <p className="text-xs text-texto-tenue">
                    {ETIQUETA_CANAL[k.channel]} · <code>{k.key_prefix}…</code> ·{" "}
                    {k.last_used_at ? `último uso ${formatearFechaHora(k.last_used_at)}` : "sin uso todavía"}
                  </p>
                </div>
                <Button
                  tamano="sm"
                  variante="secundario"
                  onClick={async () => {
                    if (notificar(await activarClaveCanal(slug, k.id, !k.is_active))) router.refresh();
                  }}
                >
                  {k.is_active ? "Desactivar" : "Activar"}
                </Button>
                <button
                  type="button"
                  onClick={() => setABorrar(k)}
                  className="rounded-comp-sm p-1 text-texto-sec hover:bg-error-suave hover:text-error"
                  aria-label="Eliminar clave"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>

      <ConfirmDialog
        abierto={!!aBorrar}
        onCerrar={() => setABorrar(null)}
        titulo="Eliminar clave"
        mensaje={`"${aBorrar?.name}" deja de poder cargar pedidos en el acto.`}
        textoConfirmar="Eliminar"
        peligro
        onConfirmar={async () => {
          const k = aBorrar;
          setABorrar(null);
          if (k && notificar(await eliminarClaveCanal(slug, k.id))) router.refresh();
        }}
      />
    </Card>
  );
}
