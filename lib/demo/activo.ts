/**
 * MODO DEMO LOCAL: el panel corre con datos inventados en memoria, sin
 * tocar Supabase. Solo se activa con `DEMO_LOCAL=1` y nunca en producción
 * (`next build` / Netlify corren con NODE_ENV=production).
 *
 *   DEMO_LOCAL=1 npm run dev
 */
export const DEMO_LOCAL =
  process.env.DEMO_LOCAL === "1" && process.env.NODE_ENV !== "production";

export const COOKIE_USUARIO_DEMO = "demo_usuario";
