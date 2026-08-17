import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { History, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { hasPermission, type StaffRole } from "@odontoflow/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSession, ROLE_INFO } from "@/lib/auth";
import { auditList, getDefaultTeam } from "@/lib/console-data";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  const rol = session.role;
  if (!hasPermission(rol, "reports.view_all")) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card>
          <EmptyState
            icon={ShieldAlert}
            title="Acceso restringido"
            description="Tu rol no tiene permiso para ver el registro de auditoría."
          />
        </Card>
      </div>
    );
  }

  const filas = await auditList(team.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Auditoría"
        description="Registro automático de acciones clave del equipo."
      />

      {filas.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title="Aún no hay actividad"
            description="Las acciones del equipo (citas, pagos, cierres…) se registran aquí automáticamente."
          />
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Acción</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Momento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((fila) => {
                const rolLog = (fila.payload as { rol?: string } | null)?.rol;
                const rolLabel =
                  rolLog && rolLog in ROLE_INFO
                    ? ROLE_INFO[rolLog as StaffRole].label
                    : rolLog ?? "—";
                return (
                  <TableRow key={fila.id}>
                    <TableCell>
                      <Badge variant="secondary">{fila.accion}</Badge>
                    </TableCell>
                    <TableCell>
                      {fila.entidad ? (
                        <p className="text-sm">
                          {fila.entidad}
                          {fila.entidadId ? (
                            <span className="tabular-nums text-muted-foreground">
                              {" "}
                              · {fila.entidadId.slice(0, 8)}…
                            </span>
                          ) : null}
                        </p>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{rolLabel}</TableCell>
                    <TableCell>{fila.userName ?? "Sistema"}</TableCell>
                    <TableCell className="tabular-nums">
                      <span title={`Hora exacta: ${format(fila.createdAt, "HH:mm")}`}>
                        {formatDistanceToNow(fila.createdAt, {
                          addSuffix: true,
                          locale: es,
                        })}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
