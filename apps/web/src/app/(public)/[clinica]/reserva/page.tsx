import { use } from "react";
import { STATUS_LABEL } from "@odontoflow/ui";
import type { AppointmentStatus } from "@odontoflow/core";

const initialStatus: AppointmentStatus = "solicitada";

interface Step {
  numero: number;
  titulo: string;
  descripcion: string;
}

const pasos: Step[] = [
  {
    numero: 1,
    titulo: "Servicio",
    descripcion: "Elige el servicio que necesitas (catálogo y precios de la clínica).",
  },
  {
    numero: 2,
    titulo: "Fecha y franja",
    descripcion:
      "Escoge el día y una franja (mañana/tarde). Puedes indicar preferencia de doctor, sin ver su agenda.",
  },
  {
    numero: 3,
    titulo: "Datos y consentimiento",
    descripcion: "Ingresa tus datos de contacto y acepta el consentimiento.",
  },
];

export default function ReservaPage({
  params,
}: Readonly<{ params: Promise<{ clinica: string }> }>) {
  const { clinica } = use(params);

  return (
    <main style={{ maxWidth: "42rem", margin: "0 auto", padding: "2rem 1rem" }}>
      <p style={{ color: "var(--of-text-muted)", fontSize: "0.875rem" }}>
        Reserva en línea de{" "}
        <strong style={{ color: "var(--of-primary)" }}>{clinica}</strong>
      </p>
      <h1 style={{ color: "var(--of-primary)" }}>Reserva tu cita</h1>
      <p>
        Esta página es pública: no requiere cuenta. Al completar los pasos, la
        clínica revisa tu solicitud y te confirma la hora exacta.
      </p>

      <ol
        style={{
          listStyle: "none",
          padding: 0,
          display: "grid",
          gap: "1rem",
          margin: "1.5rem 0",
        }}
      >
        {pasos.map((paso) => (
          <li
            key={paso.numero}
            style={{
              background: "var(--of-surface)",
              border: "1px solid var(--of-border)",
              borderRadius: "var(--of-radius)",
              padding: "1rem",
            }}
          >
            <h2 style={{ fontSize: "1rem" }}>
              Paso {paso.numero}: {paso.titulo}
            </h2>
            <p style={{ color: "var(--of-text-muted)", fontSize: "0.9375rem" }}>
              {paso.descripcion}
            </p>
          </li>
        ))}
      </ol>

      <p style={{ fontSize: "0.9375rem" }}>
        Al enviar, tu solicitud quedará en estado{" "}
        <span style={{ fontWeight: 600 }}>{STATUS_LABEL[initialStatus]}</span>{" "}
        hasta que la clínica la confirme.
      </p>

      <button
        disabled
        style={{
          background: "var(--of-primary)",
          color: "var(--of-on-primary)",
          border: "none",
          borderRadius: "var(--of-radius)",
          padding: "0.75rem 1.5rem",
          fontWeight: 600,
          fontSize: "1rem",
          cursor: "not-allowed",
          opacity: 0.7,
        }}
      >
        Próximamente: reservar aquí
      </button>
    </main>
  );
}
