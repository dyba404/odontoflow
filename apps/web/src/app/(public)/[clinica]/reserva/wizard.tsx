"use client";

import { useState } from "react";

interface ServicioItem {
  id: string;
  nombre: string;
  duracionMin: number;
  precio: string;
}

interface DoctorItem {
  membershipId: string;
  name: string;
}

interface Props {
  clinicaSlug: string;
  clinicaName: string;
  servicios: ServicioItem[];
  doctores: DoctorItem[];
}

const CARD_STYLE: React.CSSProperties = {
  background: "var(--of-surface)",
  border: "1px solid var(--of-border)",
  borderRadius: "var(--of-radius)",
  padding: "1rem",
};

const BTN_PRIMARY: React.CSSProperties = {
  background: "var(--of-primary)",
  color: "var(--of-on-primary)",
  border: "none",
  borderRadius: "var(--of-radius)",
  padding: "0.6rem 1.2rem",
  fontWeight: 600,
  cursor: "pointer",
};

const BTN_GHOST: React.CSSProperties = {
  background: "transparent",
  color: "var(--of-primary)",
  border: "1px solid var(--of-border)",
  borderRadius: "var(--of-radius)",
  padding: "0.6rem 1.2rem",
  cursor: "pointer",
};

function fechaISO(offsetDias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function WizardReserva({ clinicaSlug, clinicaName, servicios, doctores }: Props) {
  const [paso, setPaso] = useState(1);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(fechaISO(1));
  const [doctorSel, setDoctorSel] = useState<string>("");
  const [slots, setSlots] = useState<Array<{ startTime: string; endTime: string }> | null>(null);
  const [slotSel, setSlotSel] = useState<{ startTime: string; endTime: string } | null>(null);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");
  const [consentimiento, setConsentimiento] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ fecha: string; hora: string } | null>(null);

  const servicio = servicios.find((s) => s.id === serviceId) ?? null;

  async function cargarSlots() {
    if (!serviceId) return;
    setCargandoSlots(true);
    setError(null);
    setSlots(null);
    setSlotSel(null);
    try {
      const q = new URLSearchParams({ serviceId, date: fecha });
      if (doctorSel) q.set("doctorId", doctorSel);
      const r = await fetch(`/api/clinicas/${clinicaSlug}/slots?${q.toString()}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "error_slots");
      setSlots(j.slots ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error_inesperado");
    } finally {
      setCargandoSlots(false);
    }
  }

  async function enviar() {
    if (!serviceId || !slotSel) return;
    if (!consentimiento) {
      setError("Debes aceptar el consentimiento de tratamiento de datos.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch(`/api/clinicas/${clinicaSlug}/solicitudes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          date: fecha,
          startTime: slotSel.startTime,
          endTime: slotSel.endTime,
          doctorMembershipId: doctorSel || null,
          nombre,
          celular,
          email: email || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        throw new Error(
          j.error === "slot_no_disponible"
            ? "Ese horario acaba de ocuparse. Elige otro."
            : j.error ?? "error_envio",
        );
      }
      setResultado({ fecha: j.cita.fecha, hora: `${j.cita.horaIni}–${j.cita.horaFin}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "error_envio");
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    return (
      <main style={{ maxWidth: "42rem", margin: "0 auto", padding: "2rem 1rem" }}>
        <div style={{ ...CARD_STYLE, textAlign: "center", padding: "2rem" }}>
          <h1 style={{ color: "var(--of-primary)" }}>Solicitud enviada</h1>
          <p style={{ fontSize: "1.0625rem" }}>
            {servicio?.nombre} · {resultado.fecha} · {resultado.hora}
          </p>
          <p style={{ color: "var(--of-text-muted)" }}>
            {clinicaName} revisará tu solicitud y te confirmará la hora exacta por
            teléfono o correo. Puedes reprogramar o cancelar respondiendo a su
            confirmación.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: "42rem", margin: "0 auto", padding: "2rem 1rem" }}>
      <p style={{ color: "var(--of-text-muted)", fontSize: "0.875rem" }}>
        Reserva en línea de <strong style={{ color: "var(--of-primary)" }}>{clinicaName}</strong>
      </p>
      <h1 style={{ color: "var(--of-primary)" }}>Reserva tu cita</h1>
      <p style={{ color: "var(--of-text-muted)", fontSize: "0.9375rem" }}>
        Paso {paso} de 3 · La clínica confirmará tu hora por teléfono o correo.
      </p>

      {error && (
        <p style={{ color: "#b91c1c", fontSize: "0.9375rem" }} role="alert">
          {error}
        </p>
      )}

      {paso === 1 && (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {servicios.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setServiceId(s.id);
                setPaso(2);
              }}
              style={{
                ...CARD_STYLE,
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                <strong>{s.nombre}</strong>
                <span style={{ color: "var(--of-text-muted)", fontSize: "0.875rem", marginLeft: "0.5rem" }}>
                  {s.duracionMin} min
                </span>
              </span>
              <span style={{ fontWeight: 600 }}>S/ {s.precio}</span>
            </button>
          ))}
        </div>
      )}

      {paso === 2 && (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div style={CARD_STYLE}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "0.375rem" }}>
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              min={fechaISO(0)}
              onChange={(e) => {
                setFecha(e.target.value);
                setSlots(null);
                setSlotSel(null);
              }}
              style={{ padding: "0.5rem", borderRadius: "var(--of-radius)", width: "100%" }}
            />
            <label style={{ display: "block", fontWeight: 600, margin: "0.75rem 0 0.375rem" }}>
              Doctor (opcional)
            </label>
            <select
              value={doctorSel}
              onChange={(e) => {
                setDoctorSel(e.target.value);
                setSlots(null);
                setSlotSel(null);
              }}
              style={{ padding: "0.5rem", borderRadius: "var(--of-radius)", width: "100%" }}
            >
              <option value="">Cualquier doctor disponible</option>
              {doctores.map((d) => (
                <option key={d.membershipId} value={d.membershipId}>
                  {d.name}
                </option>
              ))}
            </select>
            <div style={{ marginTop: "0.75rem" }}>
              <button onClick={cargarSlots} disabled={cargandoSlots} style={BTN_PRIMARY}>
                {cargandoSlots ? "Buscando..." : "Ver horarios"}
              </button>
            </div>
          </div>

          {slots && slots.length === 0 && (
            <p style={{ color: "var(--of-text-muted)" }}>
              No hay horarios libres ese día. Prueba otra fecha.
            </p>
          )}

          {slots && slots.length > 0 && (
            <div style={{ ...CARD_STYLE }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "0.375rem" }}>
                Horarios de {servicio?.nombre} ({servicio?.duracionMin} min)
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {slots.map((s) => (
                  <button
                    key={s.startTime}
                    onClick={() => setSlotSel(s)}
                    style={{
                      padding: "0.4rem 0.75rem",
                      borderRadius: "999px",
                      border:
                        slotSel?.startTime === s.startTime
                          ? "2px solid var(--of-primary)"
                          : "1px solid var(--of-border)",
                      background:
                        slotSel?.startTime === s.startTime ? "var(--of-primary-soft, #e0f2f1)" : "transparent",
                      cursor: "pointer",
                      fontWeight: slotSel?.startTime === s.startTime ? 700 : 400,
                    }}
                  >
                    {s.startTime}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button onClick={() => setPaso(1)} style={BTN_GHOST}>
              Volver
            </button>
            <button
              onClick={() => setPaso(3)}
              disabled={!slotSel}
              style={{ ...BTN_PRIMARY, opacity: slotSel ? 1 : 0.5, cursor: slotSel ? "pointer" : "not-allowed" }}
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {paso === 3 && (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div style={CARD_STYLE}>
            <p style={{ margin: 0, fontWeight: 600 }}>
              {servicio?.nombre} · {fecha} · {slotSel?.startTime}
            </p>
            <p style={{ color: "var(--of-text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
              S/ {servicio?.precio} · se paga en clínica
            </p>
          </div>

          <div style={{ ...CARD_STYLE, display: "grid", gap: "0.75rem" }}>
            <label>
              <span style={{ fontWeight: 600 }}>Nombre completo</span>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem", borderRadius: "var(--of-radius)" }}
                placeholder="Ej. Elena Torres"
              />
            </label>
            <label>
              <span style={{ fontWeight: 600 }}>Celular (WhatsApp)</span>
              <input
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
                required
                style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem", borderRadius: "var(--of-radius)" }}
                placeholder="Ej. 987654321"
              />
            </label>
            <label>
              <span style={{ fontWeight: 600 }}>Correo (opcional)</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem", borderRadius: "var(--of-radius)" }}
              />
            </label>
            <label style={{ display: "flex", gap: "0.5rem", fontSize: "0.875rem" }}>
              <input
                type="checkbox"
                checked={consentimiento}
                onChange={(e) => setConsentimiento(e.target.checked)}
              />
              Acepto que mis datos se usen para gestionar la cita (Ley 29733 -
              Protección de datos personales).
            </label>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button onClick={() => setPaso(2)} style={BTN_GHOST}>
              Volver
            </button>
            <button
              onClick={enviar}
              disabled={enviando || !nombre.trim() || !celular.trim() || !consentimiento}
              style={{
                ...BTN_PRIMARY,
                opacity: enviando || !nombre.trim() || !celular.trim() || !consentimiento ? 0.5 : 1,
              }}
            >
              {enviando ? "Enviando..." : "Enviar solicitud"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
