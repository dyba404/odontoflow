import { hasPermission } from "@odontoflow/core";
import type { PaymentMethod, StaffRole } from "@odontoflow/core";

const metodos: PaymentMethod[] = [
  "yape",
  "plin",
  "efectivo",
  "tarjeta_pos",
  "tarjeta_online",
];

const rolesCaja: StaffRole[] = ["receptionist", "owner"];

export default function CajaPage() {
  return (
    <section>
      <h1>Caja</h1>
      <p style={{ color: "var(--of-text-muted)" }}>
        Registro de pagos del día y cuadre. Solo recepción y dueño
        (<strong>{rolesCaja.filter((r) => hasPermission(r, "payments.register")).join(" · ")}</strong>{" "}
        pueden registrar pagos).
      </p>
      <p style={{ fontSize: "0.875rem" }}>
        Métodos soportados: <strong>{metodos.join(" · ")}</strong>
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
        Movimientos del día: próximamente
      </div>
    </section>
  );
}
