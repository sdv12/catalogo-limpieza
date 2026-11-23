import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { cookies } from "next/headers";
import { DEMO_LOCAL, COOKIE_USUARIO_DEMO } from "@/lib/demo/activo";
import { USUARIOS_DEMO } from "@/lib/demo/datos";
import { ID_USUARIO_DEMO_POR_DEFECTO } from "@/lib/demo/cliente";
import { BarraDemo } from "@/components/demo/BarraDemo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Catálogo — Panel de administración",
  description:
    "Panel de carga y gestión de productos para distribuidora de artículos de limpieza.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const usuarioDemo = DEMO_LOCAL
    ? (await cookies()).get(COOKIE_USUARIO_DEMO)?.value || ID_USUARIO_DEMO_POR_DEFECTO
    : null;
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-fondo text-texto">
        {children}
        <Toaster position="top-right" richColors closeButton />
        {usuarioDemo && (
          <BarraDemo
            actual={usuarioDemo}
            usuarios={USUARIOS_DEMO.map((u) => ({ id: u.id, nombre: u.full_name }))}
          />
        )}
      </body>
    </html>
  );
}
