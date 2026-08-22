import Link from "next/link";
import { redirect } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock, Camera, CreditCard, FileText, FlaskRound, Mail, Phone, Receipt, Users, Sparkles } from "lucide-react";
import { ShieldCheck } from "lucide-react";
import { hasPermission } from "@odontoflow/core";
import { and, asc, desc, eq, isNotNull, ne } from "drizzle-orm";
import { getDb, labOrders, attachments, services, insurers, patientCoverages, patients } from "@odontoflow/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/console/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { OdontogramaV2 } from "./odontograma-v2";
import { Periodontograma } from "./periodontograma";
import { PlanesCard } from "./planes-card";
import { ConsentV2Card } from "./consent-v2-card";
import { AsignacionesPaciente } from "@/app/consola/cuotas/asignaciones-paciente";
import { NotaForm } from "./nota-form";
import { AdjuntosUploader } from "./adjuntos-uploader";
import { ConsentDialog } from "./consent-dialog";
import { EditDialog } from "./edit-dialog";
import { RepresentanteDialog } from "./representante-dialog";
import { LaboratorioCard } from "./laboratorio-card";
import { FotosCard } from "./fotos-card";
import { CoberturasCard } from "./coberturas-card";
import {
  getDefaultTeam,
  fichaPaciente,
  registrosPaciente,
  toothStatesPaciente,
  odontogramaChartPaciente,
  periodoRegistrosPaciente,
  adjuntosDePaciente,
  consentimientosDePaciente,
} from "@/lib/console-data";
import { getSession } from "@/lib/auth";
import { planDeTenant, planEsProOMayor } from "@/lib/plans";
import { fmtPEN, fmtFechaRelativa } from "@/lib/format";
import { PortalLinkButton } from "./portal-link-button";

export const dynamic = "force-dynamic";

const METODO_BADGE: Record<string, "teal" | "amber" | "green" | "blue" | "violet" | "gray"> = {
  yape: "violet",
  plin: "teal",
  efectivo: "green",
  tarjeta_pos: "blue",
  tarjeta_online: "amber",
  otro: "gray",
};

const METODO_LABEL: Record<string, string> = {
  yape: "Yape",
  plin: "Plin",
  efectivo: "Efectivo",
  tarjeta_pos: "Tarjeta POS",
  tarjeta_online: "Tarjeta online",
  otro: "Otro",
};

function fechaLarga(fecha: string): string {
  return format(new Date(`${fecha}T12:00:00`), "cccc, d 'de' MMMM 'de' yyyy", { locale: es });
}

function fmtKB(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function FichaPacientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  const ficha = await fichaPaciente(team.id, id);

  if (!ficha) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Card>
          <EmptyState
            icon={Users}
            title="Paciente no encontrado"
            description="La ficha no existe o fue eliminada."
            action={
              <Link
                href="/consola/pacientes"
                className="inline-flex h-8 items-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
              >
                Volver al listado
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const [dientes, registros] = await Promise.all([
    toothStatesPaciente(ficha.paciente.id),
    registrosPaciente(ficha.paciente.id),
  ]);
  const chart = await odontogramaChartPaciente(team.id, ficha.paciente.id);
  const canEdit = hasPermission(session.role, "records.edit");
  const pro = planEsProOMayor(await planDeTenant(team.id));
  const periRegs = (
    pro
      ? await periodoRegistrosPaciente(team.id, ficha.paciente.id)
      : []
  ).map((r) => ({ id: r.id, nota: r.nota, creadoEl: r.createdAt.toISOString() }));

  const [adjuntos, consentimientos] = await Promise.all([
    adjuntosDePaciente(team.id, id),
    consentimientosDePaciente(team.id, id),
  ]);

  const db = getDb();
  const [pedidosLab, fotosRows, serviciosRows] = await Promise.all([
    db
      .select({
        id: labOrders.id,
        tipo: labOrders.tipo,
        laboratorio: labOrders.laboratorio,
        fechaPromesa: labOrders.fechaPromesa,
        costo: labOrders.costo,
        estado: labOrders.estado,
        notas: labOrders.notas,
        createdAt: labOrders.createdAt,
      })
      .from(labOrders)
      .where(and(eq(labOrders.tenantId, team.id), eq(labOrders.patientId, id)))
      .orderBy(desc(labOrders.createdAt)),
    db
      .select({
        id: attachments.id,
        nombre: attachments.nombre,
        fotoTipo: attachments.fotoTipo,
        fotoOrden: attachments.fotoOrden,
        tratamiento: attachments.tratamiento,
        mime: attachments.mime,
        createdAt: attachments.createdAt,
      })
      .from(attachments)
      .where(
        and(
          eq(attachments.tenantId, team.id),
          eq(attachments.patientId, id),
          isNotNull(attachments.fotoTipo),
        ),
      )
      .orderBy(asc(attachments.createdAt)),
    db.select({ nombre: services.nombre }).from(services).where(eq(services.tenantId, team.id)),
  ]);

  const [coberturaRows, aseguradoraRows, opcionesRepresentante] = await Promise.all([
    db
      .select({
        id: patientCoverages.id,
        insurerId: patientCoverages.insurerId,
        plan: patientCoverages.plan,
        copagoPct: patientCoverages.copagoPct,
        vigenteDesde: patientCoverages.vigenteDesde,
        vigenteHasta: patientCoverages.vigenteHasta,
        activo: patientCoverages.activo,
        notas: patientCoverages.notas,
        insurerNombre: insurers.nombre,
      })
      .from(patientCoverages)
      .innerJoin(insurers, eq(patientCoverages.insurerId, insurers.id))
      .where(and(eq(patientCoverages.patientId, id), eq(insurers.tenantId, team.id)))
      .orderBy(desc(patientCoverages.createdAt)),
    db
      .select({ id: insurers.id, nombre: insurers.nombre })
      .from(insurers)
      .where(and(eq(insurers.tenantId, team.id), eq(insurers.activo, true)))
      .orderBy(asc(insurers.nombre)),
    db
      .select({ id: patients.id, nombre: patients.nombre })
      .from(patients)
      .where(
        and(
          eq(patients.tenantId, team.id),
          eq(patients.activo, true),
          ne(patients.id, id),
        ),
      )
      .orderBy(asc(patients.nombre))
      .limit(200),
  ]);

  const gruposFotos = new Map<string, typeof fotosRows>();
  for (const f of fotosRows) {
    const key = f.tratamiento ?? "";
    const arr = gruposFotos.get(key);
    if (arr) arr.push(f);
    else gruposFotos.set(key, [f]);
  }
  const gruposFoto = Array.from(gruposFotos.entries()).map(([tratamiento, fotos]) => ({
    tratamiento,
    fotos: fotos.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      fotoTipo: f.fotoTipo,
      fotoOrden: f.fotoOrden,
      mime: f.mime,
      createdAt: f.createdAt,
    })),
  }));
  const listaServicios = serviciosRows.map((s) => s.nombre);
  const { paciente, citas, pagos } = ficha;

  const totalPagado = pagos.reduce((acc, p) => acc + Number(p.monto), 0);
  const ultimaVisita = citas[0]?.fecha ?? null;
  let ultimaActualizacion: Date | null = null;
  for (const d of dientes) {
    const dt = new Date(d.updatedAt);
    if (!Number.isNaN(dt.getTime()) && (!ultimaActualizacion || dt.getTime() > ultimaActualizacion.getTime())) {
      ultimaActualizacion = dt;
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap items-start gap-4">
            <Avatar name={paciente.nombre} className="size-16 text-xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold leading-tight">{paciente.nombre}</h2>
                {paciente.alergias ? <Badge variant="destructive">Alergias: {paciente.alergias}</Badge> : null}
                {paciente.gestacion ? <Badge variant="amber">Gestación</Badge> : null}
                {canEdit ? (
                  <EditDialog
                    patientId={paciente.id}
                    iniciales={{
                      antecedentes: paciente.antecedentes,
                      medicacion: paciente.medicacion,
                      alergias: paciente.alergias,
                      gestacion: paciente.gestacion,
                    }}
                  />
                ) : null}
                {hasPermission(session.role, "patients.manage") ? (
                  <PortalLinkButton patientId={paciente.id} />
                ) : null}
                {canEdit ? (
                  <RepresentanteDialog
                    patientId={paciente.id}
                    pacienteNombre={paciente.nombre}
                    representanteId={paciente.representanteId}
                    opciones={opcionesRepresentante}
                  />
                ) : null}
              </div>
              <div className="mt-3 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-3">
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5 shrink-0" />
                  {paciente.celular}
                </span>
                <span className="flex items-center gap-1.5 truncate">
                  <Mail className="size-3.5 shrink-0" />
                  {paciente.email ?? "Sin email"}
                </span>
                <span className="flex items-center gap-1.5">
                  <CreditCard className="size-3.5 shrink-0" />
                  {paciente.documento ?? "Sin documento"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-muted/30 p-4">
              <span className="text-xs text-muted-foreground">Visitas</span>
              <p className="mt-1 text-xl font-semibold tabular-nums">{citas.length}</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5" />
                Última visita
              </span>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {ultimaVisita ? fmtFechaRelativa(ultimaVisita) : "—"}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Receipt className="size-3.5" />
                Total pagado
              </span>
              <p className="mt-1 text-xl font-semibold tabular-nums">{fmtPEN(totalPagado)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-5 pb-4">
            <CardTitle className="text-sm font-medium">Historial de citas</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {citas.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin citas registradas todavía.
              </p>
            ) : (
              <ul className="divide-y">
                {citas.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{fechaLarga(c.fecha)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {c.servicio}
                        {c.doctorNombre ? ` · ${c.doctorNombre}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge status={c.estado} />
                      <span className="min-w-16 text-right text-sm font-semibold tabular-nums">
                        {fmtPEN(Number(c.monto))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5 pb-4">
            <CardTitle className="text-sm font-medium">Pagos</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {pagos.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin pagos registrados todavía.
              </p>
            ) : (
              <ul className="divide-y">
                {pagos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Badge variant={METODO_BADGE[p.metodo] ?? "gray"}>
                        {METODO_LABEL[p.metodo] ?? p.metodo}
                      </Badge>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {p.referencia ?? "Sin referencia"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums">{fmtPEN(Number(p.monto))}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(p.createdAt), "d 'de' MMM yyyy", { locale: es })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {pro ? (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-5 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FlaskRound className="size-4 text-primary" />
              Laboratorio
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <LaboratorioCard
              patientId={paciente.id}
              pedidoInicial={pedidosLab.map((p) => ({
                id: p.id,
                tipo: p.tipo,
                laboratorio: p.laboratorio,
                fechaPromesa: p.fechaPromesa,
                costo: p.costo,
                estado: p.estado,
                notas: p.notas,
                createdAt: p.createdAt,
              }))}
              canEdit={canEdit}
              servicios={listaServicios}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Camera className="size-4 text-primary" />
              Fotos antes y después
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <FotosCard patientId={paciente.id} grupos={gruposFoto} canEdit={canEdit} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4 text-primary" />
              Seguro y coberturas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <CoberturasCard
              patientId={paciente.id}
              coberturas={coberturaRows.map((c) => ({
                id: c.id,
                insurerId: c.insurerId,
                plan: c.plan,
                copagoPct: c.copagoPct,
                vigenteDesde: c.vigenteDesde,
                vigenteHasta: c.vigenteHasta,
                activo: c.activo,
                notas: c.notas,
                insurerNombre: c.insurerNombre,
              }))}
              aseguradoras={aseguradoraRows}
              canEdit={canEdit}
            />
          </CardContent>
        </Card>
      </div>
      ) : (
        <ProHint titulo="Laboratorio, fotos y coberturas" />
      )}

      {pro ? (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FileText className="size-4 text-primary" />
            Documentos y consentimientos
          </CardTitle>
          {canEdit ? (
            <div className="flex items-center gap-2">
              <ConsentDialog patientId={paciente.id} />
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          {canEdit ? <AdjuntosUploader patientId={paciente.id} /> : null}

          {consentimientos.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Consentimientos firmados
              </p>
              <ul className="divide-y">
                {consentimientos.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{c.servicioNombre}</p>
                      <p className="text-xs text-muted-foreground">
                        Firmado por {c.signedBy}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: es })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {adjuntos.length === 0 && consentimientos.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Sin documentos todavía. Sube un archivo o registra un consentimiento firmado.
            </p>
          ) : null}

          {adjuntos.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Adjuntos
              </p>
              <ul className="divide-y">
                {adjuntos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link
                        href={`/api/adjuntos/${a.id}?variant=preview`}
                        target="_blank"
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {a.nombre}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {a.tipo === "consentimiento"
                          ? "Consentimiento (PDF)"
                          : a.tipo === "rx"
                            ? "Radiografía"
                            : "Documento"}
                        {a.nota ? ` · ${a.nota}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {fmtKB(a.sizeBytes)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
      ) : (
        <ProHint titulo="Documentos y consentimientos" />
      )}

      <Card>
        <CardHeader className="p-5 pb-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FileText className="size-4 text-primary" />
            Notas clínicas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          {registros.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Sin notas registradas.</p>
          ) : (
            <ul className="divide-y">
              {registros.map((r) => (
                <li key={r.id} className="py-3">
                  <p className="whitespace-pre-wrap text-sm">{r.nota}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.authorNombre ?? "Sistema"} ·{" "}
                    {formatDistanceToNow(new Date(r.createdAt), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {canEdit ? <NotaForm patientId={paciente.id} /> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3 p-5 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-sm font-medium">Odontograma clínico</CardTitle>
            <span className="text-xs text-muted-foreground">
              {ultimaActualizacion
                ? `Actualizado ${formatDistanceToNow(new Date(ultimaActualizacion), { addSuffix: true, locale: es })}`
                : "Sin registros todavía"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <OdontogramaV2
            patientId={paciente.id}
            canEdit={canEdit}
            chartInicial={
              chart
                ? { status: chart.status, plan: chart.plan, version: chart.version }
                : null
            }
          />
        </CardContent>
      </Card>

      {pro ? (
        <Card>
          <CardHeader className="space-y-3 p-5 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-sm font-medium">Periodontograma</CardTitle>
              <span className="text-xs text-muted-foreground">
                {periRegs.length > 0
                  ? `${periRegs.length} episodio${periRegs.length === 1 ? "" : "s"} registrado${periRegs.length === 1 ? "" : "s"}`
                  : "Sin episodios todavía"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <Periodontograma
              patientId={paciente.id}
              canEdit={canEdit}
              registros={periRegs}
            />
          </CardContent>
        </Card>
      ) : (
        <ProHint titulo="Periodontograma digital" />
      )}

      {pro ? (
        <Card>
          <CardHeader className="p-5 pb-4">
            <CardTitle className="text-sm font-medium">Planes de tratamiento</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <PlanesCard patientId={paciente.id} />
          </CardContent>
        </Card>
      ) : null}

      {pro ? (
        <Card>
          <CardHeader className="p-5 pb-4">
            <CardTitle className="text-sm font-medium">Consentimientos firmados (v2)</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <ConsentV2Card patientId={paciente.id} canEdit={canEdit} />
          </CardContent>
        </Card>
      ) : null}

      {pro ? (
        <Card>
          <CardHeader className="p-5 pb-4">
            <CardTitle className="text-sm font-medium">Pagos asignados</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <AsignacionesPaciente patientId={paciente.id} nombrePaciente={paciente.nombre} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ProHint({ titulo }: { titulo: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Sparkles className="size-5" />
        </span>
        <p className="text-sm font-semibold">{titulo} es parte del plan Pro</p>
        <p className="max-w-md text-[13px] text-muted-foreground">
          Tu plan Free incluye la ficha básica: odontograma y notas clínicas. Actualiza a Pro por
          Yape o Plin para desbloquear este módulo.
        </p>
        <Link
          href="/consola/config/suscripcion"
          className="inline-flex h-8 items-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
        >
          Ver planes y suscripción
        </Link>
      </CardContent>
    </Card>
  );
}
