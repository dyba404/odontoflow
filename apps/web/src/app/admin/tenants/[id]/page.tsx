import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Building2, History } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, teams, subscriptions } from "@odontoflow/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { PlanEditor } from "@/app/admin/plan-editor";
import { MembersList } from "@/app/admin/members-list";
import { BulkMembership } from "@/app/admin/bulk-membership";
import { accionesRecientesTenant, auditList } from "@/lib/console-data";
import { requirePlatformSession } from "@/lib/guard-sesion";
import { ROLE_INFO } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ESTADO_LABEL: Record<string, string> = {
  activo: "Activo",
  por_renovar: "Por renovar",
  suspendido: "Suspendido",
  cancelado: "Cancelado",
};

export default async function AdminTenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformSession();
  const { id } = await params;

  const db = getDb();
  const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
  if (!team) notFound();

  const [sub, accionesSoporte, logAuditTenant] = await Promise.all([
    db.select().from(subscriptions).where(eq(subscriptions.tenantId, id)).limit(1),
    accionesRecientesTenant(id),
    auditList(id, 25),
  ]);
  const s = sub[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title={team.name}
        description={`/${team.slug} · creada el ${format(team.createdAt, "dd/MM/yyyy")}`}
        action={
          <div className="flex items-center gap-2">
            <BulkMembership tenantId={team.id} tenantName={team.name} />
            <PlanEditor
              tenantId={team.id}
              tenantName={team.name}
              iniciales={{
                plan: s?.plan ?? null,
                estado: s?.estado ?? null,
                vence: s?.vence ?? null,
                monto: s?.monto ?? null,
                nota: s?.nota ?? null,
              }}
            />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {s?.plan === "premium" ? (
          <Badge variant="violet">Premium</Badge>
        ) : s?.plan === "pro" ? (
          <Badge className="bg-primary/10 text-primary">Pro</Badge>
        ) : (
          <Badge variant="outline">Free</Badge>
        )}
        <BadgeEstado estado={s?.estado ?? null} />
        {s?.vence ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            Vence el {format(new Date(`${s.vence}T00:00:00`), "dd/MM/yyyy")}
          </span>
        ) : null}
      </div>

      <Card>
        <CardContent className="space-y-5 p-5">
          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Miembros</h2>
              </div>
            </div>
            <MembersList tenantId={team.id} />
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <History className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Actividad de soporte (este tenant)</h2>
              </div>
              <span className="text-xs text-muted-foreground">
                {accionesSoporte.length === 0
                  ? "Sin acciones"
                  : "Últimas acciones del equipo de plataforma"}
              </span>
            </div>
            {accionesSoporte.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Suscripción, bloqueos y membresías aplicadas por soporte aparecerán aquí.
              </p>
            ) : (
              <ul className="space-y-2">
                {accionesSoporte.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <Badge variant="secondary">{a.accion}</Badge>
                      <span className="ml-2 text-xs text-muted-foreground">
                        por {a.userName ?? "plataforma"}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatDistanceToNow(a.createdAt, { addSuffix: true, locale: es })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold">Última actividad interna del equipo</h2>
            </div>
            {logAuditTenant.length === 0 ? (
              <EmptyState
                icon={History}
                title="Sin actividad todavía"
                description="Citas, pagos y otras acciones del staff se registran aquí."
              />
            ) : (
              <ul className="space-y-2">
                {logAuditTenant.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <span className="font-medium">{a.accion}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {a.userName ?? "Sistema"}
                        {(a.payload as { rol?: string } | null)?.rol
                          ? ` (${ROLE_INFO[(a.payload as { rol: string }).rol as keyof typeof ROLE_INFO]?.label ?? (a.payload as { rol: string }).rol})`
                          : ""}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatDistanceToNow(a.createdAt, { addSuffix: true, locale: es })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              El equipo puede ver su registro completo en Consola → Auditoría.
            </p>
          </section>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        <Link href="/admin/tenants" className="underline underline-offset-2">
          ← Volver a tenants
        </Link>
      </p>
    </div>
  );
}

function BadgeEstado({ estado }: { estado: string | null }) {
  const e = estado ?? "activo";
  if (e === "activo") return <Badge variant="green">Activo</Badge>;
  if (e === "por_renovar") return <Badge variant="amber">Por renovar</Badge>;
  if (e === "suspendido" || e === "cancelado") return <Badge variant="red">{ESTADO_LABEL[e]}</Badge>;
  return <Badge variant="gray">—</Badge>;
}
