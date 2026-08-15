import { STATUS_LABEL, statusBadgeStyle } from "@odontoflow/ui";
import type { AppointmentStatus } from "@odontoflow/core";

const enFila: Array<{ paciente: string; status: AppointmentStatus }> = [
  { paciente: "María Q.", status: "en_espera" },
  { paciente: "Juan P.", status: "en_atencion" },
  { paciente: "Lucía R.", status: "confirmada" },
  { paciente: "Carlos M.", status: "atendida" },
];

export default function SalaEsperaPage() {
  return (
    <section>
      <h1>Sala de espera</h1>
      <p style={{ color: "var(--of-text-muted)" }}>
        Tablero interno en tiempo real (solo recepción/asistente/doctor). Se
        usa para llamar al siguiente paciente; nunca es visible para los
        pacientes.
      </p>

      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
        {enFila.map((item) => (
          <li
            key={item.paciente}
            style={{
              background: "var(--of-surface)",
              border: "1px solid var(--of-border)",
              borderRadius: "var(--of-radius)",
              padding: "0.75rem 1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
            }}
          >
            <span>{item.paciente}</span>
            <span style={statusBadgeStyle(item.status)}>
              {STATUS_LABEL[item.status]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
