import { redirect } from "next/navigation";
import { hasPermission } from "@odontoflow/core";
import { QrCode } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { DataList, DataRow } from "@/components/console/data-list";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb, patients, payments } from "@odontoflow/db";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { gatePlan } from "@/lib/plans";
import { PlanGate } from "@/components/console/plan-gate";
import { ConciliarPago } from "./conciliar-pago";
import { fmtPEN } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CuotasConciliacionPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const descripcion =
    "Pagos por QR de Yape/Plin generados en el portal del paciente, esperando verificación.";

  if (!hasPermission(session.role, "payments.register")) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="Pagos por conciliar" description={descripcion} />
        <Card>
          <EmptyState
            icon={QrCode}
            title="Acceso restringido"
            description="Solo los roles Dueña y Recepción pueden conciliar pagos."
          />
        </Card>
      </div>
    );
  }

  const planCheck = await gatePlan(session.teamId, "caja");
  if (!planCheck.ok) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="Pagos por conciliar" description={descripcion} />
        <PlanGate feature="caja" requerido={planCheck.requerido} />
      </div>
    );
  }

  const db = getDb();
  const pendientes = await db
    .select({
      id: payments.id,
      monto: payments.monto,
      metodo: payments.metodo,
      referencia: payments.referencia,
      createdAt: payments.createdAt,
      patientId: payments.patientId,
      patientNombre: patients.nombre,
    })
    .from(payments)
    .leftJoin(patients, eq(payments.patientId, patients.id))
    .where(
      and(
        eq(payments.tenantId, session.teamId),
        eq(payments.estado, "por_conciliar"),
        like(payments.referencia, "QR:%"),
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(100);

  const historial = await db
    .select({
      id: payments.id,
      monto: payments.monto,
      metodo: payments.metodo,
      referencia: payments.referencia,
      estado: payments.estado,
      createdAt: payments.createdAt,
      patientNombre: patients.nombre,
      conciliado: sql<string>`coalesce(to_char(${payments.anuladoAt}, 'YYYY-MM-DD'), to_char(${payments.createdAt}, 'YYYY-MM-DD'))`,
    })
    .from(payments)
    .leftJoin(patients, eq(payments.patientId, patients.id))
    .where(
      and(
        eq(payments.tenantId, session.teamId),
        like(payments.referencia, "QR:%"),
        sql`${payments.estado} in ('valido', 'anulado')`,
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(30);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Pagos por conciliar" description={descripcion} />

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          El paciente genera el QR desde su portal y paga por Yape o Plin. Verifica la
          transferencia en tu banca antes de confirmar: el pago entra a caja y la cuota se
          marca pagada automáticamente.
        </p>
      </div>

      <Card>
        {pendientes.length === 0 ? (
          <EmptyState
            icon={QrCode}
            title="Nada por conciliar"
            description="Cuando un paciente pague una cuota por QR, aparecerá aquí para verificar el pago."
          />
        ) : (
          <>
            {/* Lista compacta: móvil y tablet */}
            <DataList className="p-4 pt-2 lg:hidden">
              {pendientes.map((p) => (
                <DataRow
                  key={p.id}
                  title={
                    <span className="truncate">{p.patientNombre ?? "—"}</span>
                  }
                  meta={
                    <>
                      <span className="capitalize">{p.metodo}</span>
                      {" · "}
                      {p.referencia}
                      {" · "}
                      {p.createdAt
                        ? new Intl.DateTimeFormat("es-PE", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(p.createdAt))
                        : "—"}
                    </>
                  }
                  trailing={
                    <span className="text-sm font-semibold tabular-nums">
                      {fmtPEN(Number(p.monto))}
                    </span>
                  }
                  actions={<ConciliarPago paymentId={p.id} monto={Number(p.monto)} />}
                />
              ))}
            </DataList>

            {/* Tabla: desktop */}
            <div className="hidden lg:block">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendientes.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm font-medium">{p.patientNombre ?? "—"}</TableCell>
                    <TableCell className="text-sm capitalize">{p.metodo}</TableCell>
                    <TableCell className="text-sm tabular-nums">{p.referencia}</TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      {fmtPEN(Number(p.monto))}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {p.createdAt
                        ? new Intl.DateTimeFormat("es-PE", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(p.createdAt))
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <ConciliarPago paymentId={p.id} monto={Number(p.monto)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      {historial.length > 0 && (
        <Card>
          <div className="p-5 pb-2">
            <p className="text-sm font-medium">Historial reciente</p>
          </div>

          {/* Lista compacta: móvil y tablet */}
          <DataList className="px-4 pb-4 lg:hidden">
            {historial.map((h) => (
              <DataRow
                key={h.id}
                title={<span className="truncate">{h.patientNombre ?? "—"}</span>}
                meta={
                  <>
                    {h.referencia}
                    {" · "}
                    {h.conciliado}
                    {h.estado === "valido" ? (
                      <span className="ml-1.5 rounded-full bg-emerald-500/14 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        Conciliado
                      </span>
                    ) : (
                      <span className="ml-1.5 rounded-full bg-red-500/12 px-2 py-0.5 text-[11px] font-medium text-red-700">
                        Rechazado
                      </span>
                    )}
                  </>
                }
                trailing={
                  <span className="text-sm tabular-nums">{fmtPEN(Number(h.monto))}</span>
                }
              />
            ))}
          </DataList>

          {/* Tabla: desktop */}
          <div className="hidden px-0 pb-2 lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historial.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm">{h.patientNombre ?? "—"}</TableCell>
                    <TableCell className="text-sm tabular-nums">{h.referencia}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {fmtPEN(Number(h.monto))}
                    </TableCell>
                    <TableCell className="text-sm">
                      {h.estado === "valido" ? (
                        <span className="rounded-full bg-emerald-500/14 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          Conciliado
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-500/12 px-2 py-0.5 text-[11px] font-medium text-red-700">
                          Rechazado
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {h.conciliado}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
