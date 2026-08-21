"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileCheck2, PenLine, LockKeyhole } from "lucide-react";
import { PadDeFirma } from "@/components/firma/pad-de-firma";

type Presupuesto = {
  titulo: string;
  items: Array<{ descripcion?: string; cantidad?: number; precioUnitario?: number }>;
  total: string | number;
  expiraEn: string | null;
  estado: string;
  clinicaNombre: string;
};

function fmtPEN(n: number): string {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);
}

export function PresupuestoPublico({ token }: { token: string }) {
  const [paso, setPaso] = useState<"2fa" | "ver" | "firmar" | "ok">("2fa");
  const [codigo, setCodigo] = useState("");
  const [modo, setModo] = useState<"phone_last4" | "dob" | "manual_code" | "desconocido">(
    "desconocido",
  );
  const [presupuesto, setPresupuesto] = useState<Presupuesto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [firma, setFirma] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<"paciente" | "tutor">("paciente");
  const [error, setError] = useState<string | null>(null);

  async function llamar(accion: "verificar" | "aceptar", extra?: Record<string, unknown>) {
    setCargando(true);
    setError(null);
    try {
      const r = await fetch(`/api/publico/presupuesto/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion, ...extra }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        presupuesto?: Presupuesto;
      };
      if (!r.ok) {
        setError(
          j.error === "two_factor_incorrecto"
            ? "Código incorrecto. Verifica e intenta de nuevo."
            : j.error === "demasiados_intentos"
              ? "Demasiados intentos. Espera 15 minutos."
              : j.error === "presupuesto_vencido"
                ? "Este presupuesto ya venció. Contacta a la clínica."
                : j.error === "presupuesto_ya_aceptado"
                  ? "Este presupuesto ya fue aceptado."
                  : j.error === "link_no_valido"
                    ? "El enlace no es válido."
                    : "No se pudo completar la operación.",
        );
        return null;
      }
      return j;
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      return null;
    } finally {
      setCargando(false);
    }
  }

  async function verificar() {
    if (!codigo.trim()) return;
    const payload: Record<string, unknown> = { accion: "verificar" };
    if (modo === "phone_last4") payload.last4 = codigo.trim();
    else if (modo === "dob") payload.dob = codigo.trim();
    else payload.codigo = codigo.trim();
    const j = await llamar("verificar", payload);
    if (j?.presupuesto) {
      setPresupuesto(j.presupuesto);
      setPaso("ver");
    }
  }

  async function aceptar() {
    if (!firma || !nombre.trim()) {
      toast.error("Firma y nombre son obligatorios");
      return;
    }
    const j = await llamar("aceptar", {
      last4: modo === "phone_last4" ? codigo.trim() : undefined,
      dob: modo === "dob" ? codigo.trim() : undefined,
      codigo: modo === "manual_code" ? codigo.trim() : undefined,
      firmanteNombre: nombre.trim(),
      firmanteRol: rol,
      signatureData: firma,
    });
    if (j) {
      setPaso("ok");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 p-4">
      <header className="space-y-1 text-center">
        <p className="text-lg font-semibold">
          {presupuesto?.clinicaNombre ?? "Odontoflow"}
        </p>
        <p className="text-xs text-muted-foreground">Aceptación de presupuesto</p>
      </header>

      {paso === "2fa" ? (
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <LockKeyhole className="size-4" /> Verificación de identidad
          </div>
          {modo === "desconocido" ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Elige cómo quieres verificar tu identidad:
              </p>
              {[
                { id: "phone_last4" as const, label: "Últimos 4 dígitos de mi celular" },
                { id: "dob" as const, label: "Mi fecha de nacimiento (AAAA-MM-DD)" },
                { id: "manual_code" as const, label: "Código que me dio la clínica" },
              ].map((o) => (
                <Button
                  key={o.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setModo(o.id)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <Label>
                {modo === "phone_last4"
                  ? "Últimos 4 dígitos de tu celular"
                  : modo === "dob"
                    ? "Fecha de nacimiento (AAAA-MM-DD)"
                    : "Código entregado por la clínica"}
              </Label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                inputMode={modo === "phone_last4" ? "numeric" : undefined}
                type={modo === "manual_code" ? "password" : "text"}
                placeholder={
                  modo === "phone_last4" ? "1234" : modo === "dob" ? "1990-01-31" : "••••"
                }
              />
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
              <Button className="w-full" disabled={cargando || !codigo.trim()} onClick={verificar}>
                {cargando ? <Loader2 className="size-4 animate-spin" /> : "Verificar"}
              </Button>
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => {
                  setModo("desconocido");
                  setCodigo("");
                }}
              >
                Elegir otro método
              </button>
            </div>
          )}
        </Card>
      ) : null}

      {paso === "ver" && presupuesto ? (
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileCheck2 className="size-4" /> {presupuesto.titulo}
          </div>
          <ul className="divide-y rounded-lg border text-sm">
            {(presupuesto.items ?? []).map((it, i) => (
              <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0">
                  {it.descripcion ?? "Tratamiento"}
                  <span className="block text-xs text-muted-foreground">
                    x{it.cantidad ?? 1}
                  </span>
                </span>
                <span className="shrink-0 font-medium">
                  {fmtPEN(Number(it.precioUnitario ?? 0) * (it.cantidad ?? 1))}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Total</span>
            <span>{fmtPEN(Number(presupuesto.total ?? 0))}</span>
          </div>
          {presupuesto.expiraEn ? (
            <p className="text-xs text-muted-foreground">Válido hasta {presupuesto.expiraEn}</p>
          ) : null}
          <Button className="w-full" onClick={() => setPaso("firmar")}>
            <PenLine className="size-4" /> Aceptar y firmar
          </Button>
        </Card>
      ) : null}

      {paso === "firmar" && presupuesto ? (
        <Card className="space-y-4 p-5">
          <div className="text-sm font-medium">Firma tu aceptación</div>
          <div className="space-y-2">
            <Label>Nombre completo</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Firmo como</Label>
            <div className="flex gap-2">
              {(["paciente", "tutor"] as const).map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={rol === r ? "default" : "outline"}
                  onClick={() => setRol(r)}
                >
                  {r === "paciente" ? "Paciente" : "Tutor/representante"}
                </Button>
              ))}
            </div>
          </div>
          <PadDeFirma onChange={setFirma} />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setPaso("ver")}>
              Volver
            </Button>
            <Button
              className="flex-1"
              disabled={cargando || !firma || !nombre.trim()}
              onClick={aceptar}
            >
              {cargando ? <Loader2 className="size-4 animate-spin" /> : "Confirmar"}
            </Button>
          </div>
        </Card>
      ) : null}

      {paso === "ok" ? (
        <Card className="space-y-2 p-8 text-center">
          <FileCheck2 className="mx-auto size-10 text-emerald-600" />
          <p className="text-sm font-semibold">¡Presupuesto aceptado!</p>
          <p className="text-xs text-muted-foreground">
            La clínica ya fue notificada. Nos pondremos en contacto contigo.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
