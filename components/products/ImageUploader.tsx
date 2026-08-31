"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { imagenUrl } from "@/lib/storage";
import { BUCKET_IMAGENES } from "@/lib/constants";

export type ImagenProducto = { path: string; url: string; alt?: string | null };

export function ImageUploader({
  catalogId,
  valor,
  onChange,
}: {
  catalogId: string;
  valor: ImagenProducto[];
  onChange: (imgs: ImagenProducto[]) => void;
}) {
  const [subiendo, setSubiendo] = useState(0);

  async function agregar(files: FileList | null) {
    if (!files?.length) return;
    const supabase = createClient();
    setSubiendo((n) => n + files.length);
    const nuevas: ImagenProducto[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`"${file.name}" no es una imagen`);
        setSubiendo((n) => n - 1);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`"${file.name}" supera los 5 MB`);
        setSubiendo((n) => n - 1);
        continue;
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${catalogId}/incoming/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET_IMAGENES)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      setSubiendo((n) => n - 1);
      if (error) {
        toast.error(`No se pudo subir "${file.name}": ${error.message}`);
        continue;
      }
      nuevas.push({ path, url: imagenUrl(path) });
    }
    if (nuevas.length) onChange([...valor, ...nuevas]);
  }

  async function quitar(path: string) {
    onChange(valor.filter((i) => i.path !== path));
    // borrado best-effort del objeto recién subido
    if (path.includes("/incoming/")) {
      await createClient().storage.from(BUCKET_IMAGENES).remove([path]);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {valor.map((img, i) => (
          <div
            key={img.path}
            className="relative size-24 overflow-hidden rounded-comp-sm border border-linea bg-superficie-sec"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="size-full object-cover" />
            {i === 0 && (
              <span className="absolute left-1 top-1 rounded bg-primario px-1 text-[10px] font-semibold text-white">
                Principal
              </span>
            )}
            <button
              type="button"
              onClick={() => quitar(img.path)}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black"
              aria-label="Quitar imagen"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        <label className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-comp-sm border border-dashed border-linea-fuerte text-texto-tenue hover:border-primario hover:text-primario">
          {subiendo > 0 ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <ImagePlus size={20} />
          )}
          <span className="text-[11px]">Agregar</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              agregar(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="mt-1 text-xs text-texto-tenue">
        La primera imagen es la principal. JPG/PNG/WebP, hasta 5 MB.
      </p>
    </div>
  );
}
