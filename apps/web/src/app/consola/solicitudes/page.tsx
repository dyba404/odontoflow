import { eq } from "drizzle-orm";
import { getDb, appointments, patients, services, teams } from "@odontoflow/db";
import { STATUS_LABEL, statusBadgeStyle } from "@odontoflow/ui";
import { BotonConfirmar } from "./boton-confirmar";

export const dynamic = "force-dynamic";

export default async function SolicitudesPage() {
  const db = getDb();

  const team = (await db.select().from(teams).limit(1))[0];

  if (!team) {
    return (
      <section>
        <h1>Solicitudes en línea</h1>
        <p style={{ color: "var(--of-text-muted)" }}>Sin clínicas todavía. Ejecuta el seed.</p>
      </section>
    );
  }

  const filas = await db
    .select({
      id: appointments.id,
      fecha: appointments.fecha,
      horaIni: appointments.horaIni,
      horaFin: appointments.horaFin,
      estado: appointments.estado,
      notas: appointments.notas,
      pacienteNombre: patients.nombre,
      pacienteCelular: patients.celular,
      servicio: services.nombre,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .where(eq(appointments.estado, "solicitada"));

  return (
    <section>
      <h1>Solicitudes en línea</h1>
      <p style={{ color: "var(--of-text-muted)" }}>
        Cola de solicitudes del portal público de <strong>{team.name}</strong>. Revisa y
        confirma la hora sugerida.
      </p>

      {filas.length === 0 ? (
        <p style={{ color: "var(--of-text-muted)" }}>
          No hay solicitudes pendientes. Comparte la página{" "}
          <code>/{team.slug}/reserva</code>.
        </p>
      ) : (
        <div
          style={{
            border: "1px solid var(--of-border)",
            borderRadius: "var(--of-radius)",
            background: "var(--of-surface)",
            marginTop: "1rem",
          }}
        >
          {filas.map((f) => (
            <div
              key={f.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                padding: "0.875rem 1rem",
                borderBottom: "1px solid var(--of-border)",
              }}
            >
              <div>
                <strong>{f.pacienteNombre}</strong>
                <span style={{ color: "var(--of-text-muted)", marginLeft: "0.5rem", fontSize: "0.875rem" }}>
                  {f.servicio} · {f.fecha} {f.horaIni}–{f.horaFin}
                </span>
                <div style={{ color: "var(--of-text-muted)", fontSize: "0.8125rem" }}>
                  Cel: {f.pacienteCelular}
                  {f.notas ? ` · Nota: ${f.notas}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={statusBadgeStyle(f.estado)}>{STATUS_LABEL[f.estado]}</span>
                <BotonConfirmar citaId={f.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
