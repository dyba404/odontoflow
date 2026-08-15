export default function LandingPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "2rem",
        background:
          "linear-gradient(180deg, var(--of-primary) 0%, var(--of-primary-hover) 100%)",
        color: "var(--of-on-primary)",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", letterSpacing: "-0.02em" }}>
        Odontoflow
      </h1>
      <p style={{ fontSize: "1.125rem", maxWidth: "40rem", opacity: 0.95 }}>
        Gestión completa para tu consultorio odontológico en Perú: agenda,
        sala de espera, caja, fichas clínicas y recordatorios — en un solo
        lugar.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", flexWrap: "wrap", justifyContent: "center" }}>
        <a
          href="/dental/reserva"
          style={{
            background: "var(--of-surface)",
            color: "var(--of-primary)",
            borderRadius: "var(--of-radius)",
            padding: "0.75rem 1.5rem",
            fontWeight: 600,
          }}
        >
          Ver demo de reserva
        </a>
        <a
          href="/consola"
          style={{
            border: "1px solid var(--of-on-primary)",
            color: "var(--of-on-primary)",
            borderRadius: "var(--of-radius)",
            padding: "0.75rem 1.5rem",
            fontWeight: 600,
          }}
        >
          Consola de la clínica
        </a>
      </div>
      <p style={{ marginTop: "2rem", fontSize: "0.875rem", opacity: 0.8 }}>
        Agenda · Sala de espera · Caja · Pacientes · Solicitudes en línea
      </p>
    </main>
  );
}
