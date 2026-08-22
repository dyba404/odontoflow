import { redirect } from "next/navigation";
import { hasPermission } from "@odontoflow/core";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { Lock, Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSession } from "@/lib/auth";
import { getDefaultTeam } from "@/lib/console-data";
import { informeReferidos, linkReferido } from "@/lib/referidos";
import { CopiarLinkReferido } from "./copiar-link-referido";

export const dynamic = "force-dynamic";

export default async function ReferidosPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  if (!hasPermission(session.role, "reports.view_all")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Referidos"
          description="Pacientes que traen nuevos pacientes con su link personal."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Tu rol no tiene permiso para ver el informe de referidos."
          />
        </Card>
      </div>
    );
  }

  const filas = await informeReferidos(team.id);
  const totalReferidos = filas.reduce((acc, f) => acc + f.referidos, 0);
  const totalConfirmadas = filas.reduce((acc, f) => acc + f.citasConfirmadas, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Referidos"
        description="Pacientes que traen nuevos pacientes con su link personal."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground">Pacientes referentes</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{filas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground">Pacientes referidos</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{totalReferidos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground">Citas confirmadas/atendidas</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{totalConfirmadas}</p>
          </CardContent>
        </Card>
      </div>

      {filas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Aún no hay referidos"
            description="Cuando un paciente nuevo llegue con el link de un referente, lo verás aquí."
          />
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referente</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="text-center">Referidos</TableHead>
                <TableHead className="text-center">Citas confirmadas</TableHead>
                <TableHead className="w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.patientId}>
                  <TableCell>
                    <p className="text-sm font-medium">{f.nombre}</p>
                    <p className="text-xs text-muted-foreground">{f.celular}</p>
                  </TableCell>
                  <TableCell className="text-sm font-mono tabular-nums">
                    {f.codigo ?? "—"}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">{f.referidos}</TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {f.citasConfirmadas}
                  </TableCell>
                  <TableCell>
                    {f.codigo ? (
                      <CopiarLinkReferido url={linkReferido(team.slug, f.codigo)} />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="px-5 pb-4 pt-2 text-xs text-muted-foreground">
            Comparte el link de reserva con el código del paciente: quien reserve con ese link
            quedará registrado como referido automáticamente.
          </p>
        </Card>
      )}
    </div>
  );
}
