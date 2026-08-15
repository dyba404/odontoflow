import { canTransition } from "@odontoflow/core";
import { STATUS_LABEL, statusBadgeStyle } from "@odontoflow/ui";

const cola = [
  { paciente: "Elena T.", servicio: "Limpieza dental", preferencia: "Mañana" },
  { paciente: "Ricardo S.", servicio: "Consulta general", preferencia: "Tarde" },
];

export default function SolicitudesPage() {
  return (
    <section>
      <h1>Solicitudes en línea</h1>
      <p style={{ color: "var(--of-text-muted)" }}>
        Cola de solicitudes de pacientes desde la página pública. Recepción
        aprueba o ajusta, asigna doctor y hora exacta, y confirma por
        email/SMS.
      </p>
      <p style={{ fontSize: "0.875rem" }}>
        Flujo:{" "}
        <span style={statusBadgeStyle("solicitada")}>
          {STATUS_LABEL["solicitada"]}
        </span>{" "}
        →{" "}
        <span style={statusBadgeStyle("confirmada")}>
          {STATUS_LABEL["confirmada"]}
        </span>{" "}
        {canTransition("solicitada", "confirmada") ? "(transición válida)" : ""}
      </p>

      <div
        style={{
          border: "1px solid var(--of-border)",
          borderRadius: "var(--of-radius)",
          background: "var(--of-surface)",
          marginTop: "1rem",
        }}
      >
        {cola.map((s) => (
          <div
            key={s.paciente}
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
              <strong>{s.paciente}</strong>
              <span style={{ color: "var(--of-text-muted)", marginLeft: "0.5rem", fontSize: "0.875rem" }}>
                {s.servicio} · {s.preferencia}
              </span>
            </div>
            <span style={statusBadgeStyle("solicitada")}>
              {STATUS_LABEL["solicitada"]}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
