import { redirect } from "next/navigation";

export default function IndexPage() {
  // El panel vive en /panel; el proxy redirige a /login si no hay sesión.
  redirect("/panel");
}
