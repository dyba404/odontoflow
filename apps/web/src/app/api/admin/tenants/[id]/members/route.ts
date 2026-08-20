import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, teams, memberships, users } from "@odontoflow/db";
import { ipReq } from "@/lib/rate-limit";
import { adminGuard } from "@/lib/admin-guard";
import { ultimaSesionPorUsuario } from "@/lib/console-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await adminGuard("miembros", ipReq(req));
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const db = getDb();
  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, id)).limit(1);
  if (!team) return NextResponse.json({ error: "tenant_no_encontrado" }, { status: 404 });

  const rows = await db
    .select({
      membershipId: memberships.id,
      active: memberships.active,
      role: memberships.role,
      userId: users.id,
      name: users.name,
      email: users.email,
      lockedAt: users.lockedAt,
      isPlatformAdmin: users.isPlatformAdmin,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.teamId, id))
    .orderBy(desc(memberships.createdAt));

  const ultimaSesion = await ultimaSesionPorUsuario(id);

  const miembros = rows.map((r) => ({
    membershipId: r.membershipId,
    userId: r.userId,
    name: r.name,
    email: r.email,
    role: r.role,
    active: r.active,
    lockedAt: r.lockedAt,
    isPlatformAdmin: r.isPlatformAdmin,
    ultimaSesion: ultimaSesion.get(r.userId) ?? null,
  }));

  return NextResponse.json({ ok: true, miembros });
}
