import { cache } from "react";
import { cookies } from "next/headers";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import {
  getDb,
  sessions,
  users,
  memberships,
  teams,
} from "@odontoflow/db";
import { hasPermission, type Permission, type StaffRole } from "@odontoflow/core";

export const SESSION_COOKIE = "of_session";
const SESSION_DAYS = 30;
const EXTEND_WHEN_LESS_THAN_MS = 7 * 24 * 3600_000;

export const ROLE_INFO: Record<StaffRole, { label: string }> = {
  owner: { label: "Dueño/a" },
  receptionist: { label: "Recepción" },
  assistant: { label: "Asistente" },
  doctor: { label: "Odontólogo/a" },
};

export interface SessionUser {
  userId: string;
  name: string;
  email: string;
  teamId: string;
  teamName: string;
  teamSlug: string;
  teamTimezone: string;
  membershipId: string;
  role: StaffRole;
  sessionToken: string;
  sessionExpiresAt: Date;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (err, key) => {
      if (err) return reject(err);
      resolve(`scrypt:${salt}:${Buffer.from(key).toString("hex")}`);
    });
  });
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  return new Promise((resolve) => {
    const parts = stored.split(":");
    if (parts.length !== 3 || parts[0] !== "scrypt") return resolve(false);
    const salt = parts[1];
    const expected = parts[2];
    if (!salt || !expected) return resolve(false);
    scrypt(password, salt, 64, (err, key) => {
      if (err) return resolve(false);
      const buf = Buffer.from(expected, "hex");
      const candidate = Buffer.from(key);
      resolve(buf.length === candidate.length && timingSafeEqual(buf, candidate));
    });
  });
}

export async function createSession(opts: {
  userId: string;
  tenantId: string;
  membershipId: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600_000);
  await getDb().insert(sessions).values({
    sessionToken: token,
    userId: opts.userId,
    tenantId: opts.tenantId,
    membershipId: opts.membershipId,
    expiresAt,
    userAgent: opts.userAgent ?? null,
    ip: opts.ip ?? null,
  });
  return { token, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.sessionToken, token));
}

export function sessionCookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  };
}

export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 3600;

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await getDb()
    .select({
      sessionToken: sessions.sessionToken,
      sessionExpiresAt: sessions.expiresAt,
      userId: users.id,
      name: users.name,
      email: users.email,
      teamId: teams.id,
      teamName: teams.name,
      teamSlug: teams.slug,
      teamTimezone: teams.timezone,
      membershipId: memberships.id,
      role: memberships.role,
      active: memberships.active,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(memberships, eq(sessions.membershipId, memberships.id))
    .innerJoin(teams, eq(sessions.tenantId, teams.id))
    .where(and(eq(sessions.sessionToken, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row || !row.active) return null;

  if (row.sessionExpiresAt.getTime() - Date.now() < EXTEND_WHEN_LESS_THAN_MS) {
    const nueva = new Date(Date.now() + SESSION_DAYS * 24 * 3600_000);
    await getDb()
      .update(sessions)
      .set({ expiresAt: nueva })
      .where(eq(sessions.sessionToken, token));
    row.sessionExpiresAt = nueva;
  }

  return {
    userId: row.userId,
    name: row.name,
    email: row.email,
    teamId: row.teamId,
    teamName: row.teamName,
    teamSlug: row.teamSlug,
    teamTimezone: row.teamTimezone,
    membershipId: row.membershipId,
    role: row.role as StaffRole,
    sessionToken: row.sessionToken,
    sessionExpiresAt: row.sessionExpiresAt,
  };
});

export type GuardOk = {
  ok: true;
  user: { id: string; name: string; email: string };
  team: { id: string; name: string; slug: string; timezone: string };
  membership: { id: string; role: StaffRole };
};
export type GuardErr = { ok: false; status: 401 | 403 };

export async function guardStaff(permission?: Permission): Promise<GuardOk | GuardErr> {
  const s = await getSession();
  if (!s) return { ok: false, status: 401 };
  if (permission && !hasPermission(s.role, permission)) return { ok: false, status: 403 };
  return {
    ok: true,
    user: { id: s.userId, name: s.name, email: s.email },
    team: { id: s.teamId, name: s.teamName, slug: s.teamSlug, timezone: s.teamTimezone },
    membership: { id: s.membershipId, role: s.role },
  };
}

export function guardError(g: GuardErr) {
  return g.status === 401 ? "sin_sesion" : "sin_permiso";
}

export async function hoyTenant(timezone: string): Promise<string> {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}
