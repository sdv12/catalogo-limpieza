import "server-only";

/**
 * Envío de mails vía Resend. Sin RESEND_API_KEY no manda nada (devuelve
 * false) para que el panel funcione igual antes de configurar el envío.
 */
export function mailHabilitado(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function enviarMail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
      }),
    });
    if (!r.ok) console.error("Resend error:", r.status, await r.text().catch(() => ""));
    return r.ok;
  } catch (e) {
    console.error("Resend error:", e);
    return false;
  }
}
