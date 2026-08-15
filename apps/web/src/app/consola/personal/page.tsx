import { hasPermission } from "@odontoflow/core";
import type { StaffRole } from "@odontoflow/core";

const roles: StaffRole[] = ["owner", "receptionist", "assistant", "doctor"];

const etiquetas: Record<StaffRole, string> = {
  owner: "Dueño",
  receptionist: "Recepcionista",
  assistant: "Asistente",
  doctor: "Odontólogo",
};

export default function PersonalPage() {
  return (
    <section>
      <h1>Personal</h1>
      <p style={{ color: "var(--of-text-muted)" }}>
        Miembros del equipo, horarios de turno y control de acceso fuera de
        horario. Solo dueño puede gestionarlo.
      </p>
      <p style={{ fontSize: "0.875rem" }}>
        Puede gestionar (<code>staff.manage</code>):{" "}
        <strong>{roles.filter((r) => hasPermission(r, "staff.manage")).join(" · ")}</strong>
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
        CTA: invitar al primer miembro ({Object.values(etiquetas).join(", ")})
      </div>
    </section>
  );
}
