// ============================================================
// Tarea programada: avisa a los clientes con un vencimiento próximo
// (customers_por_cobrar, DIAS_ANTES días) y a su vendedor asignado.
//
// Corre todos los días vía cron de Netlify. Sin RESEND_API_KEY no
// manda mails de verdad: solo loguea a quién avisaría (para poder
// desplegar esto antes de tener las credenciales de Resend).
//
// Env necesarias:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (ya están)
//   RESEND_API_KEY        — cuando se cargue, empieza a mandar mails
//   RESEND_FROM_EMAIL     — remitente verificado en Resend (opcional
//                            mientras se usa el dominio de prueba)
// ============================================================
import { createClient } from "@supabase/supabase-js";

const DIAS_ANTES = 4;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

type Deudor = {
  customer_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  balance: number;
  next_due_date: string;
  assigned_seller: string | null;
};

async function enviarMail(to: string[], subject: string, text: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, text }),
  });
  if (!r.ok) {
    console.error("Resend error:", r.status, await r.text().catch(() => ""));
  }
  return r.ok;
}

async function avisoDeudas() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("aviso-deudas: faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    return new Response("faltan credenciales de Supabase", { status: 500 });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: catalogos, error: eCat } = await supabase
    .from("catalogs")
    .select("id, slug, name")
    .eq("is_active", true);
  if (eCat) {
    console.error("aviso-deudas: no se pudieron listar catálogos", eCat.message);
    return new Response("error listando catálogos", { status: 500 });
  }

  let procesados = 0;
  let avisados = 0;
  let omitidos = 0;

  for (const cat of catalogos ?? []) {
    const { data: deudores, error } = await supabase.rpc("customers_por_cobrar", {
      p_catalog_id: cat.id,
      p_dias_antes: DIAS_ANTES,
    });
    if (error) {
      console.error(`aviso-deudas: customers_por_cobrar (${cat.slug})`, error.message);
      continue;
    }

    for (const d of (deudores ?? []) as Deudor[]) {
      procesados++;

      const { data: previo } = await supabase
        .from("debt_notifications")
        .select("id")
        .eq("customer_id", d.customer_id)
        .eq("due_date", d.next_due_date)
        .maybeSingle();
      if (previo) {
        omitidos++;
        continue;
      }

      const destinatarios: string[] = [];
      if (d.email) destinatarios.push(d.email);
      if (d.assigned_seller) {
        const { data: vendedor } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", d.assigned_seller)
          .maybeSingle();
        if (vendedor?.email) destinatarios.push(vendedor.email);
      }
      if (destinatarios.length === 0) {
        omitidos++;
        continue;
      }

      const monto = new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
      }).format(d.balance);
      const asunto = `Vencimiento el ${d.next_due_date} — ${d.name} (${cat.name})`;
      const cuerpo =
        `Hola,\n\n` +
        `El saldo de ${d.name} (${monto}) vence el ${d.next_due_date}.\n` +
        `Catálogo: ${cat.name}\n\n` +
        `Este es un aviso automático.`;

      let enviado = false;
      if (RESEND_KEY) {
        enviado = await enviarMail(destinatarios, asunto, cuerpo);
      } else {
        console.log(`aviso-deudas [sin RESEND_API_KEY] avisaría a ${destinatarios.join(", ")}: ${asunto}`);
      }

      if (enviado) {
        await supabase.from("debt_notifications").insert({
          catalog_id: cat.id,
          customer_id: d.customer_id,
          due_date: d.next_due_date,
          recipients: destinatarios,
        });
        avisados++;
      }
    }
  }

  const resumen = `procesados=${procesados} avisados=${avisados} omitidos=${omitidos} resend=${RESEND_KEY ? "on" : "off"}`;
  console.log("aviso-deudas:", resumen);
  return new Response(resumen, { status: 200 });
}

export default avisoDeudas;
export const config = { schedule: "0 12 * * *" };
