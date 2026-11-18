import { Footer } from "@/components/layout/Footer";
import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Ingresar — Catálogo" };

export default function LoginPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-lg font-semibold text-texto">Panel de catálogo</h1>
          <p className="mt-1 text-sm text-texto-sec">
            Ingresá con tu cuenta de administrador.
          </p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
