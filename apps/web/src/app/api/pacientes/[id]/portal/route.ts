import { and, eq } from "drizzle-orm";
import { getDb, patients } from "@odontoflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { portalUrlFor } from "@/lib/magic-link";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardStaff("patients.manage");
  if (!g.ok) return Response.json({ error: guardError(g) }, { status: g.status });

  const { id } = await params;
  const [patient] = await getDb()
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!patient) return Response.json({ error: "no_encontrado" }, { status: 404 });

  const url = await portalUrlFor(g.team.id, patient.id, g.team.slug);
  return Response.json({ ok: true, url });
}