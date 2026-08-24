import { CreditCard, Lock, Sparkles, Check, Gauge } from "lucide-react";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { RenovarYape } from "@/app/consola/config/suscripcion/renovar-yape";
import { getDefaultTeam, suscripcionTeam } from "@/lib/console-data";
import { getSession, hoyTenant } from "@/lib/auth";
import { usoPlan } from "@/lib/plans";
import { fmtPEN } from "@/lib/format";

export const dynamic = "force-dynamic";

const PLANES = [
  {
    codigo: "free",
    nombre: "Free",
    precio: 0,
    detalle: "Reservas y agenda",
    incluye: [
      "Página pública de reservas",
      "Agenda del día",
      "Cola de solicitudes",
      "Sala de espera y personal",
      "Ficha básica: odontograma y notas clínicas",
    ],
  },
  {
    codigo: "pro",
    nombre: "Pro",
    precio: 79,
    detalle: "Ficha avanzada + recordatorios",
    incluye: [
      "Todo lo de Free",
      "Ficha avanzada: laboratorio, fotos y seguros",
      "Recordatorios email/WhatsApp",
      "Recall y campañas",
      "Dashboard de ingresos y márgenes",
    ],
  },
  {
    codigo: "premium",
    nombre: "Premium",
    precio: 149,
    detalle: "Caja, facturación y ganancias",
    incluye: [
      "Todo lo de Pro",
      "Caja con Yape/Plin/POS",
      "Facturación electrónica SUNAT",
      "Inventario, presupuestos y comisiones",
    ],
  },
];

const ESTADO_LABEL: Record<string, string> = {
  activo: "Activo",
  por_renovar: "Por renovar",
  suspendido: "Suspendido",
  cancelado: "Cancelado",
};

function usoPlanNombre(plan: string): string {
  return PLANES.find((p) => p.codigo === plan)?.nombre ?? plan;
}

function UsoItem({
  label,
  valor,
  limite,
}: {
  label: string;
  valor: number;
  limite: number | null;
}) {
  const alLimite = limite !== null && valor >= limite;
  const pct = limite ? Math.min(100, Math.round((valor / limite) * 100)) : null;
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={alLimite ? "mt-1 text-lg font-semibold tabular-nums text-amber-600" : "mt-1 text-lg font-semibold tabular-nums"}>
        {limite === null ? `${valor}` : `${valor} / ${limite}`}
      </p>
      {pct !== null ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className={alLimite ? "h-full bg-amber-500" : "h-full bg-primary"}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
      {alLimite ? <p className="mt-1.5 text-[11px] text-amber-600">Límite alcanzado</p> : null}
    </div>
  );
}

export default async function SuscripcionConfigPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  if (session.role !== "owner") {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Suscripción"
          description="Plan mensual de Odontoflow. El cobro es directo: Yape, Plin o transferencia."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo el rol Dueño puede ver la suscripción del equipo."
          />
        </Card>
      </div>
    );
  }

  const [sub, uso] = await Promise.all([
    suscripcionTeam(team.id),
    usoPlan(team.id, await hoyTenant(team.timezone)),
  ]);
  const planActual = sub?.plan ?? "free";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Suscripción"
        description="Plan mensual de Odontoflow. El cobro es directo: Yape, Plin o transferencia."
      />

      <Card className="border-primary/30">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <CreditCard className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium">
                Plan actual:{" "}
                <span className="font-semibold capitalize">
                  {PLANES.find((p) => p.codigo === planActual)?.nombre ?? planActual}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {sub?.vence
                  ? `Vence el ${sub.vence}`
                  : "Activado manualmente por el equipo Odontoflow"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sub ? (
              <Badge variant={sub.estado === "activo" ? "green" : "amber"}>
                {ESTADO_LABEL[sub.estado] ?? sub.estado}
              </Badge>
            ) : null}
            <RenovarYape nombrePlan={PLANES.find((p) => p.codigo === planActual)?.nombre ?? "Odontoflow"} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <Gauge className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Uso del plan {usoPlanNombre(uso.plan)}</p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <UsoItem label="Miembros activos" valor={uso.miembros} limite={uso.limites.maxMembers} />
            <UsoItem label="Pacientes" valor={uso.pacientes} limite={uso.limites.maxPatients} />
            <UsoItem label="Citas este mes" valor={uso.citasMes} limite={uso.limites.maxCitasMes} />
          </div>
          {uso.plan === "free" ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Al llegar a un límite puedes seguir consultando tu información, pero la creación
              de nuevos registros requiere el plan Pro.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PLANES.map((p) => {
          const activo = p.codigo === planActual;
          return (
            <Card
              key={p.codigo}
              className={activo ? "border-primary/50" : undefined}
            >
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{p.nombre}</p>
                  {activo ? <Badge variant="teal">Actual</Badge> : null}
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                  {p.precio === 0 ? "S/ 0" : fmtPEN(p.precio)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">/mes</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{p.detalle}</p>
                <ul className="mt-4 flex-1 space-y-2">
                  {p.incluye.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
                {p.codigo === "premium" ? (
                  <div className="mt-4 flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
                    <Sparkles className="size-3.5" />
                    Incluye facturación electrónica SUNAT
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
