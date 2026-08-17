import { Resend } from "resend";

let cliente: Resend | null = null;

export function mailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

export function mailFrom(): string | null {
  const from = process.env.RESEND_FROM;
  if (from) return from;
  return null;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: "email_no_configurado" };
  const from = mailFrom();
  if (!from) return { ok: false, reason: "from_no_configurado (define RESEND_FROM)" };

  try {
    if (!cliente) cliente = new Resend(apiKey);
    const res = await cliente.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (res.error) return { ok: false, reason: res.error.message ?? "error_resend" };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "error_envio" };
  }
}

export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
