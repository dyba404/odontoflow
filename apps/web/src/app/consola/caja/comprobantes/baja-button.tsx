"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";

export function BajaButton({
  id,
  serie,
  correlativo,
  sunatEstado,
}: {
  id: string;
  serie: string;
  correlativo: number;
  sunatEstado: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const numero = `${serie}-${String(correlativo).padStart(8, "0")}`;

  if (sunatEstado === "baja_pendiente") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          try {
            const res = await fetch(`/api/caja/comprobantes/${id}/baja`);
            const j = (await res.json().catch(() => ({}))) as {
              error?: string;
              estado?: string;
              message?: string;
            };
            if (!res.ok) {
              toast.error(j.message ?? j.error ?? "No se pudo consultar la baja");
              return;
            }
            if (j.estado === "baja_aceptada") {
              toast.success(`Baja del ${numero} aceptada por SUNAT`);
              router.refresh();
            } else if (j.estado === "en_proceso") {
              toast.info("SUNAT aún está procesando la baja. Consulta más tarde.");
            } else {
              toast.error(`La baja del ${numero} fue rechazada por SUNAT.`);
              router.refresh();
            }
          } finally {
            setLoading(false);
          }
        }}
        title="El resumen de bajas es asíncrono: pregunta aquí el estado"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        Consultar baja
      </Button>
    );
  }

  if (sunatEstado !== "aceptado") return null;

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-red-600 hover:text-red-700"
        onClick={() => setOpen(true)}
        disabled={loading}
      >
        <Trash2 className="size-3.5" />
        Baja
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Baja del comprobante ${numero}`}
        icon={<Trash2 className="size-4 text-red-600" />}
        description="Notifica a SUNAT que este comprobante queda sin efecto."
      >
        <div className="space-y-3">
          <p className="rounded-lg border px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            Se emite una nota de crédito de anulación referenciando {numero}: SUNAT la
            valida y acepta en el momento, y el comprobante queda sin efecto. La nota
            queda listada en esta misma tabla.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="baja-motivo">
              Motivo (obligatorio)
            </label>
            <Input
              id="baja-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. error de digitación"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={loading || motivo.trim().length < 3}
              onClick={async () => {
                setLoading(true);
                try {
                  const res = await fetch(`/api/caja/comprobantes/${id}/baja`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ motivo: motivo.trim() }),
                  });
                  const j = (await res.json().catch(() => ({}))) as {
                    error?: string;
                    message?: string;
                    estado?: string;
                  };
                  if (!res.ok) {
                    toast.error(j.message ?? j.error ?? "No se pudo solicitar la baja");
                    return;
                  }
                  setOpen(false);
                  setMotivo("");
                  if (j.estado === "baja_pendiente") {
                    toast.success(`Resumen de bajas enviado. Consulta el estado aquí.`);
                  } else {
                    toast.success(`Nota de crédito aceptada. ${numero} quedó sin efecto.`);
                  }
                  router.refresh();
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Trash2 className="size-3.5" />
              Solicitar baja
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
