export default function AdminPage() {
  return (
    <main style={{ maxWidth: "42rem", margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ color: "var(--of-primary)" }}>Admin del operador</h1>
      <p style={{ color: "var(--of-text-muted)" }}>
        Panel interno del operador del SaaS: tenants activos, planes
        (free/pro/premium), facturación de suscripciones y salud de la
        plataforma.
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
        Sin tenants registrados todavía
      </div>
    </main>
  );
}
