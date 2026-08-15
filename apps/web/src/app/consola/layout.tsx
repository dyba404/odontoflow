import Link from "next/link";

const nav: Array<{ href: string; label: string }> = [
  { href: "/consola", label: "Inicio" },
  { href: "/consola/agenda", label: "Agenda del día" },
  { href: "/consola/sala-espera", label: "Sala de espera" },
  { href: "/consola/pacientes", label: "Pacientes" },
  { href: "/consola/caja", label: "Caja" },
  { href: "/consola/dashboard", label: "Dashboard" },
  { href: "/consola/personal", label: "Personal" },
  { href: "/consola/solicitudes", label: "Solicitudes" },
];

export default function ConsolaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          background: "var(--of-surface)",
          borderRight: "1px solid var(--of-border)",
          padding: "1rem 0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
        }}
      >
        <p style={{ fontWeight: 700, color: "var(--of-primary)", padding: "0 0.5rem", margin: "0 0 0.75rem" }}>
          Odontoflow
        </p>
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "block",
              padding: "0.5rem 0.75rem",
              borderRadius: "var(--of-radius)",
              color: "var(--of-text)",
              fontSize: "0.9375rem",
            }}
          >
            {item.label}
          </Link>
        ))}
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <header
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 1.25rem",
            background: "var(--of-surface)",
            borderBottom: "1px solid var(--of-border)",
          }}
        >
          <span style={{ fontWeight: 600 }}>Consola de la clínica</span>
          <span style={{ color: "var(--of-text-muted)", fontSize: "0.875rem" }}>
            Sesión: por implementarse
          </span>
        </header>
        <main style={{ padding: "1.5rem" }}>{children}</main>
      </div>
    </div>
  );
}
