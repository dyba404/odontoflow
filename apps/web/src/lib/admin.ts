import { getSession } from "@/lib/auth";

export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  const permitidos = (process.env.ADMIN_EMAILS ?? "owner@demo.odontoflow.pe")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return permitidos.includes(session.email.trim().toLowerCase());
}
