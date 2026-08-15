import { hasPermission } from "@odontoflow/core";
import type { StaffRole } from "@odontoflow/core";

const rolDemo: StaffRole = "owner";

export default function DashboardPage() {
  if (!hasPermission(rolDemo, "reports.view_all")) {
    return (
      <section>
        <h1>Sin permiso</h1>
        <p>El rol {rolDemo} no puede ver el dashboard de ingresos.</p>
      </section>
    );
  }

  return (
    <section>
      <h1>Dashboard de ingresos</h1>
      <p style={{ color: "var(--of-text-muted)" }}>
        Solo dueño: ingresos, citas del día, no-shows y cierre diario. Vista
        con números tabulares.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem" }}>
        {[
          { label: "Ingresos de hoy", valor: "S/ 0.00" },
          { label: "Citas del día", valor: "0" },
          { label: "No asistieron", valor: "0" },
        ].map((m) => (
          <div
            key={m.label}
            style={{
              background: "var(--of-surface)",
              border: "1px solid var(--of-border)",
              borderRadius: "var(--of-radius)",
              padding: "1rem",
            }}
          >
            <p style={{ fontSize: "0.8125rem", color: "var(--of-text-muted)", margin: 0 }}>{m.label}</p>
            <p style={{ fontSize: "1.5rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", margin: 0 }}>
              {m.valor}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
