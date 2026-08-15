import { hasPermission } from "@odontoflow/core";
import type { Permission, StaffRole } from "@odontoflow/core";

const rolesAgenda: StaffRole[] = ["receptionist", "doctor"];

export default function AgendaPage() {
  const permisosRelevantes: Array<{ p: Permission; label: string }> = [
    { p: "agenda.view_all", label: "agenda.view_all (agenda completa)" },
    { p: "agenda.view_own", label: "agenda.view_own (solo su agenda)" },
  ];

  return (
    <section>
      <h1>Agenda del día</h1>
      <p style={{ color: "var(--of-text-muted)" }}>
        Calendario denso para recepción y doctor. Recepción ve la agenda
        completa; cada doctor solo la suya.
      </p>
      <p style={{ fontSize: "0.875rem" }}>
        Roles con acceso: <strong>{rolesAgenda.join(" · ")}</strong>
      </p>
      <ul style={{ fontSize: "0.875rem", color: "var(--of-text-muted)" }}>
        {permisosRelevantes.map(({ p, label }) => (
          <li key={p}>
            {label}:{" "}
            {rolesAgenda
              .filter((r) => hasPermission(r, p))
              .join(", ") || "—"}
          </li>
        ))}
      </ul>
      <div
        style={{
          border: "1px dashed var(--of-border)",
          borderRadius: "var(--of-radius)",
          padding: "2rem",
          textAlign: "center",
          color: "var(--of-text-muted)",
        }}
      >
        Calendario: próximamente
      </div>
    </section>
  );
}
