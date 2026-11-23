"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, X, RotateCcw, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/cn";
import { CATEGORIAS, TEMAS, TEMA_POR_ID, type Categoria, type Tema } from "@/lib/arau/temas";
import { buscarTemas, cumple, avisoPermiso } from "@/lib/arau/buscar";
import type { RolEfectivo, PermisoCatalogo } from "@/lib/roles";

/**
 * ARAU — asistente del backoffice. 100% local y hardcodeado: busca la
 * respuesta en `lib/arau/temas.ts` por palabras clave. No usa IA ni llama
 * a ningún servidor.
 */

type MensajeArau = { de: "arau"; texto: string; aviso?: string; opciones?: string[] };
type Mensaje = { de: "usuario"; texto: string } | MensajeArau;

const BIENVENIDA: Mensaje = {
  de: "arau",
  texto:
    "¡Hola! Soy ARAU, el asistente del panel. Escribime tu duda (ej: \"cómo cargo una venta\") o elegí un tema.",
  opciones: ["venta-nueva", "caja-cobrar", "producto-nuevo", "stock-ajustar"],
};

const SIN_RESULTADO =
  "No encontré una respuesta para eso. Probá con otras palabras (ej: \"stock\", \"precio\", \"cliente\", \"proveedor\") o tocá \"Temas\" para ver todo lo que sé. Si no está, anotalo y consultalo con el desarrollador.";

export function ArauChat({
  slug,
  rol,
  permisos,
}: {
  slug: string;
  rol: RolEfectivo;
  permisos: PermisoCatalogo[];
}) {
  const claveStorage = `arau:${slug}`;
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([BIENVENIDA]);
  const [texto, setTexto] = useState("");
  const [verTemas, setVerTemas] = useState(false);
  const cargadoRef = useRef(false);
  const finRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // La conversación sobrevive a la navegación dentro de la pestaña.
  function abrir() {
    if (!cargadoRef.current) {
      cargadoRef.current = true;
      try {
        const guardado = sessionStorage.getItem(claveStorage);
        if (guardado) setMensajes(JSON.parse(guardado));
      } catch {
        /* storage no disponible o corrupto */
      }
    }
    setAbierto(true);
  }

  useEffect(() => {
    if (!cargadoRef.current) return;
    try {
      sessionStorage.setItem(claveStorage, JSON.stringify(mensajes.slice(-40)));
    } catch {
      /* storage no disponible */
    }
  }, [mensajes, claveStorage]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes, abierto, verTemas]);

  useEffect(() => {
    if (abierto) inputRef.current?.focus();
  }, [abierto]);

  function respuestaDe(tema: Tema): MensajeArau {
    return {
      de: "arau",
      texto: tema.respuesta,
      aviso: cumple(tema.requiere, rol, permisos) ? undefined : avisoPermiso(tema.requiere!),
      opciones: tema.relacionados,
    };
  }

  function preguntar(pregunta: string) {
    const q = pregunta.trim();
    if (!q) return;
    const resultados = buscarTemas(q);
    let respuesta: Mensaje;
    if (resultados.length === 0) {
      respuesta = { de: "arau", texto: SIN_RESULTADO };
    } else {
      const [mejor, ...otros] = resultados;
      // Si hay otro casi igual de relevante, lo ofrecemos como alternativa.
      const alternativas = otros
        .filter((r) => r.puntos >= mejor.puntos * 0.6)
        .map((r) => r.tema.id);
      const base = respuestaDe(mejor.tema);
      respuesta = {
        ...base,
        opciones: [...new Set([...alternativas, ...(base.opciones ?? [])])].slice(0, 4),
      };
    }
    setVerTemas(false);
    setMensajes((ms) => [...ms, { de: "usuario", texto: q }, respuesta]);
    setTexto("");
  }

  function elegirTema(id: string) {
    const tema = TEMA_POR_ID.get(id);
    if (!tema) return;
    setVerTemas(false);
    setMensajes((ms) => [...ms, { de: "usuario", texto: tema.titulo }, respuestaDe(tema)]);
  }

  function nuevaConversacion() {
    setMensajes([BIENVENIDA]);
    setVerTemas(false);
  }

  return (
    <>
      {!abierto && (
        <button
          type="button"
          onClick={abrir}
          className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-primario px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-primario-fuerte"
          aria-label="Abrir ARAU, el asistente del panel"
        >
          <Bot size={20} />
          <span className="hidden sm:inline">Preguntale a ARAU</span>
        </button>
      )}

      {abierto && (
        <section
          className="fixed inset-x-2 bottom-2 z-50 flex h-[75vh] flex-col overflow-hidden rounded-comp border border-linea bg-superficie shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:h-[600px] sm:w-[400px]"
          aria-label="ARAU, asistente del panel"
        >
          <header className="flex items-center gap-2 bg-primario px-4 py-3 text-white">
            <Bot size={20} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">ARAU</p>
              <p className="text-xs opacity-80">Asistente del panel</p>
            </div>
            <button
              type="button"
              onClick={() => setVerTemas((v) => !v)}
              className={cn("rounded-comp-sm p-1.5 hover:bg-white/15", verTemas && "bg-white/20")}
              title="Temas"
              aria-label="Ver todos los temas"
              aria-pressed={verTemas}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              onClick={nuevaConversacion}
              className="rounded-comp-sm p-1.5 hover:bg-white/15"
              title="Nueva conversación"
              aria-label="Nueva conversación"
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-comp-sm p-1.5 hover:bg-white/15"
              aria-label="Cerrar ARAU"
            >
              <X size={18} />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {verTemas ? (
              <IndiceTemas onElegir={elegirTema} />
            ) : (
              mensajes.map((m, i) => (
                <Burbuja key={i} mensaje={m} onOpcion={elegirTema} />
              ))
            )}
            <div ref={finRef} />
          </div>

          <form
            className="flex items-center gap-2 border-t border-linea p-3"
            onSubmit={(e) => {
              e.preventDefault();
              preguntar(texto);
            }}
          >
            <input
              ref={inputRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={300}
              placeholder="Escribí tu pregunta…"
              className="h-10 flex-1 rounded-comp-sm border border-linea-fuerte bg-superficie px-3 text-sm text-texto outline-none focus:border-primario"
            />
            <button
              type="submit"
              disabled={!texto.trim()}
              className="flex size-10 shrink-0 items-center justify-center rounded-comp-sm bg-primario text-white hover:bg-primario-fuerte disabled:opacity-50"
              aria-label="Enviar pregunta"
            >
              <Send size={16} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}

function Burbuja({ mensaje, onOpcion }: { mensaje: Mensaje; onOpcion: (id: string) => void }) {
  if (mensaje.de === "usuario") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-comp bg-primario px-3 py-2 text-sm break-words whitespace-pre-wrap text-white">
          {mensaje.texto}
        </div>
      </div>
    );
  }
  const opciones = (mensaje.opciones ?? [])
    .map((id) => TEMA_POR_ID.get(id))
    .filter((t): t is Tema => Boolean(t));
  return (
    <div className="space-y-2">
      <div className="max-w-[90%] space-y-2 rounded-comp bg-superficie-sec px-3 py-2 text-sm break-words whitespace-pre-wrap text-texto">
        {mensaje.aviso && (
          <p className="rounded-comp-sm bg-alerta-suave px-2 py-1.5 text-texto">{mensaje.aviso}</p>
        )}
        <p>{mensaje.texto}</p>
      </div>
      {opciones.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {opciones.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onOpcion(t.id)}
              className="rounded-full border border-linea-fuerte px-3 py-1 text-left text-xs text-texto-sec hover:bg-superficie-sec hover:text-texto"
            >
              {t.titulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IndiceTemas({ onElegir }: { onElegir: (id: string) => void }) {
  const [categoria, setCategoria] = useState<Categoria | null>(null);
  const temas = categoria ? TEMAS.filter((t) => t.categoria === categoria) : [];

  if (!categoria) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-texto-sec">¿Sobre qué tenés la duda?</p>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIAS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              className="rounded-comp-sm border border-linea px-3 py-2 text-left text-sm text-texto hover:bg-superficie-sec"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setCategoria(null)}
        className="text-xs text-primario hover:underline"
      >
        ← Todos los temas
      </button>
      <p className="text-sm font-medium text-texto">{categoria}</p>
      <div className="space-y-1.5">
        {temas.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onElegir(t.id)}
            className="block w-full rounded-comp-sm border border-linea px-3 py-2 text-left text-sm text-texto hover:bg-superficie-sec"
          >
            {t.titulo}
          </button>
        ))}
      </div>
    </div>
  );
}
