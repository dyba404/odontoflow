import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, appointments } from "@odontoflow/db";
import { canTransition } from "@odontoflow/core";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();

  const rows = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  const appt = rows[0];
  if (!appt) {
    return NextResponse.json({ error: "no_encontrada" }, { status: 404 });
  }

  if (!canTransition("solicitada", "confirmada") || appt.estado !== "solicitada") {
    return NextResponse.json(
      { error: `no_se_puede_confirmar_desde_${appt.estado}` },
      { status: 409 },
    );
  }

  const [updated] = await db
    .update(appointments)
    .set({ estado: "confirmada", updatedAt: new Date() })
    .where(eq(appointments.id, id))
    .returning();
  if (!updated) {
    return NextResponse.json({ error: "no_se_pudo_actualizar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, estado: updated.estado });
}
