import { hasPermission } from "@odontoflow/core";
import type { StaffRole } from "@odontoflow/core";

const cards: Array<{ titulo: string; roles: StaffRole[]; href: string }> = [
  { titulo: "Agenda del día", roles: ["owner", "receptionist", "assistant"], href: "/consola/agenda" },
  { titulo: "Sala de espera", roles: ["owner", "receptionist", "assistant"], href: "/consola/sala-espera" },
  { titulo: "Caja", roles: ["owner", "receptionist"], href: "/consola/caja" },
  { titulo: "Solicitudes en línea", roles: ["owner", "receptionist"], href: "/consola/solicitudes" },
  { titulo: "Dashboard de ingresos", roles: ["owner"], href: "/consola/dashboard" },
];

export default function ConsolaPage() {
  const rolDemo: StaffRole = "receptionist";

  return (
    <section>
      <h1>Inicio de la consola</h1>
      <p style={{ color: "var(--of-text-muted)" }}>
        Dashboard según rol (dueño, recepción, asistente o doctor). Este panel
        mostrará citas del día, ingresos y pendientes según los permisos de tu
        cuenta.
      </p>

      <h2 style={{ marginTop: "1.5rem", fontSize: "1.125rem" }}>
        Módulos habilitados para el rol{" "}
        <span style={{ color: "var(--of-primary)" }}>{rolDemo}</span> (demo)
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "1rem",
          marginTop: "0.75rem",
        }}
      >
        {cards
          .filter((c) => c.roles.includes(rolDemo))
          .map((c) => (
            <a
              key={c.href}
              href={c.href}
              style={{
                background: "var(--of-surface)",
                border: "1px solid var(--of-border)",
                borderRadius: "var(--of-radius)",
                padding: "1rem",
                textDecoration: "none",
              }}
            >
              <strong>{c.titulo}</strong>
              <p style={{ fontSize: "0.8125rem", color: "var(--of-text-muted)", marginTop: "0.25rem" }}>
                {hasPermission(rolDemo, "payments.register") &&
                c.titulo === "Caja"
                  ? "Puede registrar pagos."
                  : "Visible según permisos."}
              </p>
            </a>
          ))}
      </div>
    </section>
  );
}
