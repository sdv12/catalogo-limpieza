import { type NextRequest, NextResponse } from "next/server";
import { DEMO_LOCAL, COOKIE_USUARIO_DEMO } from "@/lib/demo/activo";
import { USUARIOS_DEMO } from "@/lib/demo/datos";
import { reiniciarDemo } from "@/lib/demo/store";

/** Solo modo demo: cambiar de usuario o reiniciar los datos inventados. */
export async function GET(req: NextRequest) {
  if (!DEMO_LOCAL) return new NextResponse(null, { status: 404 });
  const sp = req.nextUrl.searchParams;
  const volver = sp.get("volver")?.startsWith("/") ? sp.get("volver")! : "/panel";
  const res = NextResponse.redirect(new URL(volver, req.url));

  const usuario = sp.get("usuario");
  if (usuario && USUARIOS_DEMO.some((u) => u.id === usuario)) {
    res.cookies.set(COOKIE_USUARIO_DEMO, usuario, { path: "/", sameSite: "lax" });
  }
  if (sp.get("reiniciar") === "1") reiniciarDemo();
  return res;
}
