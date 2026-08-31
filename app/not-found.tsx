import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm font-semibold text-texto-tenue">Error 404</p>
      <h1 className="text-xl font-semibold text-texto">Página no encontrada</h1>
      <Link
        href="/panel"
        className="mt-2 text-sm font-medium text-primario hover:underline"
      >
        Volver al panel
      </Link>
    </main>
  );
}
