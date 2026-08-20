import { and, eq, gte, like, sql } from "drizzle-orm";
import {
  Activity,
  Building2,
  CalendarDays,
  CheckCircle2,
  Database,
  Mail,
  ReceiptText,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { getDb, teams, users, appointments, patients, auditLogs } from "@odontoflow/db";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/console/page-header";
import { requirePlatformSession } from "@/lib/guard-sesion";
import { mailConfigurado } from "@/lib/mail";
import { lycetConfigurado } from "@/lib/lycet";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function hoyLima(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}

export default async function AdminResumenPage() {
  await requirePlatformSession();

  const db = getDb();
  const hoy = hoyLima();

  const [
    [nTenants],
    [nUsuarios],
    [nPacientes],
    [nCitasHoy],
    [nAccionesSoporte30d],
  ] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int`.mapWith(Number) }).from(teams),
    db.select({ n: sql<number>`count(*)::int`.mapWith(Number) }).from(users),
    db.select({ n: sql<number>`count(*)::int`.mapWith(Number) }).from(patients),
    db
      .select({ n: sql<number>`count(*)::int`.mapWith(Number) })
      .from(appointments)
      .where(eq(appointments.fecha, hoy)),
    db
      .select({ n: sql<number>`count(*)::int`.mapWith(Number) })
      .from(auditLogs)
      .where(
        and(
          like(auditLogs.accion, "soporte.%"),
          gte(auditLogs.createdAt, new Date(Date.now() - 30 * 86_400_000)),
        ),
      ),
  ]);

  let dbOk = false;
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
    ]);
    dbOk = true;
  } catch {
    dbOk = false;
  }
  const correoOk = mailConfigurado();
  const lycetOk = lycetConfigurado();

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Administración de la plataforma"
        description="Panel interno del operador: red de clínicas, usuarios, planes y auditoría de soporte."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Building2} label="Clínicas" value={String(nTenants?.n ?? 0)} sub="tenants" href="/admin/tenants" />
        <Stat icon={Users} label="Usuarios" value={String(nUsuarios?.n ?? 0)} sub="cuentas" href="/admin/usuarios" />
        <Stat icon={CalendarDays} label="Citas de hoy" value={String(nCitasHoy?.n ?? 0)} sub={hoy} />
        <Stat icon={ReceiptText} label="Pacientes" value={String(nPacientes?.n ?? 0)} sub="en toda la red" />
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Estado de la instancia</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Check label="Base de datos" ok={dbOk} />
            <Check
              icon={Mail}
              label="Correo (confirmaciones, avisos)"
              ok={correoOk}
              notaOff="SMTP no configurado: los emails se registran en los logs"
            />
            <Check icon={Mail} label="Facturación SUNAT (Lycet)" ok={lycetOk} notaOff="Lycet no configurado" />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {nAccionesSoporte30d?.n ?? 0} acciones de soporte en los últimos 30 días ·{" "}
            <Link href="/admin/auditoria" className="underline underline-offset-2">
              ver feed completo
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  href,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  sub: string;
  href?: string;
}) {
  const inner = (
    <>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <div className="mt-3">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
        <span className="ml-2 text-xs text-muted-foreground tabular-nums">{sub}</span>
      </div>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="flex min-h-[110px] flex-col justify-between rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="flex min-h-[110px] flex-col justify-between rounded-2xl border bg-card p-5">
      {inner}
    </div>
  );
}

function Check({
  icon: Icon = Database,
  label,
  ok,
  notaOff,
}: {
  icon?: typeof Database;
  label: string;
  ok: boolean;
  notaOff?: string;
}) {
  return (
    <div className={cn("rounded-lg border p-3", ok ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50")}>
      <p className="flex items-center gap-1.5 text-sm font-medium">
        {ok ? (
          <CheckCircle2 className="size-4 text-green-600" />
        ) : (
          <XCircle className="size-4 text-amber-600" />
        )}
        <Icon className="size-3.5 text-muted-foreground" />
        {label}
      </p>
      {!ok && notaOff ? (
        <p className="mt-1.5 text-xs text-amber-700">{notaOff}</p>
      ) : null}
    </div>
  );
}
