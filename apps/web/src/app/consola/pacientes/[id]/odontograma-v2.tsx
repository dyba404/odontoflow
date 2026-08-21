"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import "@/vendor/react-advanced-odontogram/style.css";

const OdontogramShellDynamic = dynamic(
  () =>
    import("@/vendor/react-advanced-odontogram").then((m) => {
      const { OdontogramShell } = m;
      return function Wrapped(props: Record<string, unknown>) {
        return <OdontogramShell {...props} />;
      };
    }),
  { ssr: false },
);

type ChartEstado = {
  status: unknown;
  plan: unknown;
  version: string | null;
};

export function OdontogramaV2({
  patientId,
  canEdit,
  chartInicial,
}: {
  patientId: string;
  canEdit: boolean;
  chartInicial: ChartEstado | null;
}) {
  const [estado] = useState<ChartEstado | null>(chartInicial);
  const [cargando, setCargando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimoEnvio = useRef<string>("");

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let alive = true;

    async function autoGuardar(mod: typeof import("@/vendor/react-advanced-odontogram")) {
      const status = mod.getStatusChart();
      const plan = mod.getPlanChart();
      await guardar(status, plan);
    }

    import("@/vendor/react-advanced-odontogram").then((mod) => {
      if (estado?.status) {
        try {
          mod.importStatus(estado.status);
        } catch {
          // estado incompatible: se reinicia desde cero
        }
      }
      unsub = mod.onStateChange(() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          if (alive) void autoGuardar(mod);
        }, 1200);
      });
    });

    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardar(status: unknown, plan: unknown) {
    const body = JSON.stringify({
      status,
      plan: plan && (plan as { teeth?: unknown }).teeth ? plan : null,
      version: versionDe(status),
    });
    if (body === ultimoEnvio.current) return;
    setCargando(true);
    try {
      const r = await fetch(`/api/pacientes/${patientId}/odontograma`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        toast.error(`No se pudo guardar el odontograma: ${j.error ?? "error"}`);
        return;
      }
      ultimoEnvio.current = body;
      toast.success("Odontograma guardado");
    } catch {
      toast.error("No se pudo guardar el odontograma");
    } finally {
      setCargando(false);
    }
  }

  async function guardarManual() {
    const mod = await import("@/vendor/react-advanced-odontogram");
    await guardar(mod.getStatusChart(), mod.getPlanChart());
  }

  return (
    <div className="relative space-y-3">
      {canEdit ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Haz clic en una pieza para marcar caries, obturaciones, endodoncia,
            prótesis y más. Se guarda automáticamente.
          </p>
          <div className="flex items-center gap-2">
            {cargando ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Guardando…
              </span>
            ) : null}
            <Button size="sm" variant="outline" onClick={guardarManual}>
              Guardar
            </Button>
          </div>
        </div>
      ) : null}
      <OdontogramShellDynamic
        language="es"
        numberingSystem="FDI"
        darkMode={false}
        readOnly={!canEdit}
        enableNotes={canEdit}
      />
    </div>
  );
}

function versionDe(status: unknown): string | null {
  if (status && typeof status === "object" && "version" in (status as Record<string, unknown>)) {
    const v = (status as Record<string, unknown>).version;
    return typeof v === "string" ? v : null;
  }
  return null;
}
