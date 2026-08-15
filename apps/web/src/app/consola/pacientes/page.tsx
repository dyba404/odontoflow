import { hasPermission } from "@odontoflow/core";
import type { StaffRole } from "@odontoflow/core";

const roles: StaffRole[] = ["owner", "receptionist", "assistant", "doctor"];

export default function PacientesPage() {
  return (
    <section>
      <h1>Pacientes</h1>
      <p style={{ color: "var(--of-text-muted)" }}>
        Listado y fichas de pacientes: datos de contacto, alergias y ficha
        clínica según permisos de cada rol.
      </p>
      <p style={{ fontSize: "0.875rem" }}>
        Pueden gestionar pacientes:{" "}
        <strong>{roles.filter((r) => hasPermission(r, "patients.manage")).join(" · ")}</strong>
      </p>
      <div
        style={{
          border: "1px dashed var(--of-border)",
          borderRadius: "var(--of-radius)",
          padding: "2rem",
          textAlign: "center",
          color: "var(--of-text-muted)",
        }}
      >
        Sin pacientes todavía. CTA: registrar el primer paciente
      </div>
    </section>
  );
}
