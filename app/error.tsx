"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold text-texto">Algo salió mal</h1>
      <p className="max-w-md text-sm text-texto-sec">
        Ocurrió un error inesperado. Podés reintentar; si persiste, avisá al
        equipo.
      </p>
      <Button variante="secundario" onClick={reset} className="mt-2">
        Reintentar
      </Button>
    </main>
  );
}
