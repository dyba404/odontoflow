"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarCheck2,
  CalendarIcon,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  QrCode,
  Receipt,
  ShieldCheck,
  Stethoscope,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtPEN } from "@/lib/format";

interface ProximaCita {
  id: string;
  fecha: string;
  horaIni: string;
  horaFin: string;
  estado: string;
  servicio: string | null;
  doctor: string | null;
  puedeConfirmar: boolean;
}

interface CitaHistorial {
  id: string;
  fecha: string;
  horaIni: string;
  estado: string;
  servicio: string | null;
  doctor: string | null;
}

interface Cuota {
  id: string;
  concepto: string;
  n: number;
  monto: string;
  saldo: string;
  vence: string | null;
  estado: string;
}

interface Comprobante {
  id: string;
  tipo: string;
  numero: string;
  emitidaAt: string | null;
}

interface Presupuesto {
  id: string;
  titulo: string;
  total: string;
  estado: string;
}

interface Consentimiento {
  servicioNombre: string | null;
  signedBy: string;
  signedAt: string;
}

interface PortalData {
  clinica: { nombre: string; slug: string };
  paciente: { nombre: string };
  proximasCitas: ProximaCita[];
  historial: CitaHistorial[];
  cuotasPendientes: Cuota[];
  comprobantes: Comprobante[];
  presupuestos: Presupuesto[];
  consentimientos: Consentimiento[];
}

interface PagoQr {
  qr: string;
  ref: string;
  monto: string;
  metodo: string;
  numeroYape: string | null;
  clinica: string;
}

const ESTADO_LABEL: Record<string, string> = {
  solicitada: "Pendiente de confirmación",
  confirmada: "Confirmada",
  en_espera: "En sala de espera",
  en_atencion: "En atención",
  atendida: "Atendida",
  no_show: "No asistió",
  cancelada: "Cancelada",
};

function formatFechaLarga(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

export function PortalPaciente({ token }: { token: string }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [estadoError, setEstadoError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagoCuota, setPagoCuota] = useState<Cuota | null>(null);
  const [pagoQr, setPagoQr] = useState<PagoQr | null>(null);
  const [generandoQr, setGenerandoQr] = useState(false);
  const [erroresQr, setErroresQr] = useState<Record<string, boolean>>({});

  const cargar = useCallback(async () => {
    setCargando(true);
    setEstadoError(null);
    try {
      const r = await fetch(`/api/portal/${token}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "token_invalido");
      setData(j);
    } catch {
      setEstadoError(
        "Este enlace no es válido, ya expiró o fue revocado. Pide a la clínica uno nuevo.",
      );
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function confirmarAsistencia(citaId: string) {
    setError(null);
    setMensaje(null);
    try {
      const r = await fetch(`/api/portal/${token}/confirmar-asistencia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ citaId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "error");
      setMensaje("¡Gracias! Confirmaste tu asistencia. Nos vemos pronto.");
      await cargar();
    } catch {
      setError("No se pudo confirmar la asistencia. Intenta nuevamente.");
    }
  }

  async function pagarCuota(cuota: Cuota, metodo: string) {
    setError(null);
    setMensaje(null);
    setGenerandoQr(true);
    try {
      const r = await fetch(`/api/portal/${token}/pagar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuotaId: cuota.id, metodo }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "error");
      setErroresQr((prev) => ({ ...prev, [cuota.id]: false }));
      setPagoCuota(cuota);
      setPagoQr(j);
    } catch {
      setErroresQr((prev) => ({ ...prev, [cuota.id]: true }));
    } finally {
      setGenerandoQr(false);
    }
  }

  function cerrarPago() {
    setPagoCuota(null);
    setPagoQr(null);
    void cargar();
  }

  if (cargando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (estadoError || !data) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted">
              <XCircle className="size-8 text-muted-foreground" />
            </div>
            <h1 className="mt-4 text-xl font-semibold text-foreground">Enlace no válido</h1>
            <p className="mt-2 text-sm text-muted-foreground">{estadoError ?? "Error"}</p>
          </div>
        </div>
      </main>
    );
  }

  const { clinica, paciente } = data;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
        <header className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary">
            <Stethoscope className="size-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{clinica.nombre}</p>
            <p className="text-sm text-muted-foreground">
              Hola, <span className="font-medium text-foreground">{paciente.nombre}</span>
            </p>
          </div>
        </header>

        {mensaje && (
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            <CheckCircle2 className="size-4 shrink-0" />
            {mensaje}
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {data.proximasCitas.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <CalendarCheck2 className="size-5 text-primary" />
              Tus próximas citas
            </h2>
            <div className="mt-3 space-y-3">
              {data.proximasCitas.map((c) => (
                <div key={c.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{c.servicio ?? "Servicio"}</p>
                      {c.doctor && (
                        <p className="truncate text-xs text-muted-foreground">{c.doctor}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                      {ESTADO_LABEL[c.estado] ?? c.estado}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarIcon className="size-4 shrink-0" />
                      <span>{formatFechaLarga(c.fecha)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground tabular-nums">
                      <Clock className="size-4 shrink-0" />
                      <span>
                        {c.horaIni}–{c.horaFin}
                      </span>
                    </div>
                  </div>
                  {c.puedeConfirmar && (
                    <Button
                      type="button"
                      className="mt-4 w-full"
                      onClick={() => void confirmarAsistencia(c.id)}
                    >
                      Confirmar mi asistencia
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.cuotasPendientes.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Wallet className="size-5 text-primary" />
              Cuotas por pagar
            </h2>
            <div className="mt-3 space-y-3">
              {data.cuotasPendientes.map((cuota) => (
                <div key={cuota.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 font-medium text-foreground">
                      {cuota.concepto}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        · cuota {cuota.n}
                      </span>
                    </p>
                    <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                      {fmtPEN(Number(cuota.saldo))}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {cuota.vence ? `Vence: ${cuota.vence}` : "Sin fecha de vencimiento"}
                  </p>
                  <Button
                    type="button"
                    className="mt-4 w-full"
                    onClick={() => void pagarCuota(cuota, "yape")}
                    disabled={generandoQr}
                  >
                    {generandoQr ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Generando…
                      </>
                    ) : (
                      <>
                        <QrCode className="size-4" />
                        Pagar con QR
                      </>
                    )}
                  </Button>
                  {erroresQr[cuota.id] && (
                    <p className="mt-2 text-xs text-red-600">
                      No se pudo generar el QR. Intenta nuevamente.
                    </p>
                  )}
                  {pagoCuota?.id === cuota.id && pagoQr && (
                    <div className="mt-4 rounded-xl border border-accent bg-accent/40 p-4">
                      <div className="flex flex-col items-center gap-3">
                        <img
                          src={pagoQr.qr}
                          alt="QR de pago"
                          width={280}
                          height={280}
                          className="size-56 rounded-lg bg-white p-2"
                        />
                        <div className="text-center text-sm">
                          <p className="font-medium text-foreground">
                            Escanea con Yape o Plin y paga {fmtPEN(Number(pagoQr.monto))}
                          </p>
                          {pagoQr.numeroYape && (
                            <p className="mt-1 text-muted-foreground tabular-nums">
                              o transfiere al{" "}
                              <span className="font-semibold">{pagoQr.numeroYape}</span>
                            </p>
                          )}
                          <p className="mt-1 text-muted-foreground">
                            Referencia: <span className="font-semibold">{pagoQr.ref}</span>
                          </p>
                        </div>
                        <p className="text-center text-xs text-muted-foreground">
                          Tu pago quedará registrado como &quot;por verificar&quot; hasta que la
                          clínica lo confirme.
                        </p>
                        <Button type="button" variant="outline" size="sm" onClick={cerrarPago}>
                          Ya pagué / cerrar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.comprobantes.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Receipt className="size-5 text-primary" />
              Tus comprobantes
            </h2>
            <div className="mt-3 space-y-2">
              {data.comprobantes.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{c.numero}</p>
                    <p className="text-xs capitalize text-muted-foreground">{c.tipo}</p>
                  </div>
                  <a
                    href={`/api/portal/${token}/comprobantes/${c.id}/pdf`}
                    className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    <Download className="size-3.5" />
                    PDF
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.presupuestos.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <FileText className="size-5 text-primary" />
              Presupuestos
            </h2>
            <div className="mt-3 space-y-2">
              {data.presupuestos.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{p.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.estado === "enviado" ? "Enviado por la clínica" : "Aprobado"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                    {fmtPEN(Number(p.total))}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.consentimientos.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <ShieldCheck className="size-5 text-primary" />
              Consentimientos firmados
            </h2>
            <div className="mt-3 space-y-2">
              {data.consentimientos.map((c, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-3">
                  <p className="text-sm font-medium text-foreground">
                    {c.servicioNombre ?? "Consentimiento de datos"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Firmado por {c.signedBy} ·{" "}
                    {new Date(c.signedAt).toLocaleDateString("es-PE")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.historial.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <CalendarIcon className="size-5 text-primary" />
              Historial de citas
            </h2>
            <div className="mt-3 space-y-2">
              {data.historial.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {c.servicio ?? "Servicio"}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {c.fecha} · {c.horaIni}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      c.estado === "atendida"
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {ESTADO_LABEL[c.estado] ?? c.estado}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Enlace personal y seguro · válido por 30 días
        </p>
      </div>
    </main>
  );
}
