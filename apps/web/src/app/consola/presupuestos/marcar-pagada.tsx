"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { fmtPEN } from "@/lib/format";

const METODOS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "yape", label: "Yape" },
  { value: "plin", label: "Plin" },
  { value: "tarjeta_pos", label: "Tarjeta" },
] as const;

export function MarcarPagada({
  cuotaId,
  n,
  monto,
  patientId,
  concepto,
}: {
  cuotaId: string;
  n: number;
  monto: number;
  patientId: string;
  concepto: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [metodo, setMetodo] = useState<string>("efectivo");
  const [procesando, setProcesando] = useState(false);

  async function pagar() {
    setProcesando(true);
    try {
      const rp = await fetch("/api/caja/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto,
          metodo,
          patientId,
          referencia: `Cuota ${n} · ${concepto}`,
        }),
      });
      const jp = await rp.json().catch(() => ({}));
      if (!rp.ok) throw new Error(`No se pudo registrar el pago: ${(jp as { error?: string }).error ?? "error"}`);

      const rc = await fetch(`/api/cuotas/${cuotaId}/pagar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: (jp as { id?: string }).id }),
      });
      const jc = await rc.json().catch(() => ({}));
      if (!rc.ok) throw new Error(`No se pudo marcar la cuota: ${(jc as { error?: string }).error ?? "error"}`);

      toast.success(`Cuota ${n} marcada pagada (${fmtPEN(monto)}).`);
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <CheckCircle2 className="size-3.5" />
        <span className="hidden sm:inline">Pagada</span>
      </Button>

      <Dialog
        open={open}
        onClose={() => {
          if (!procesando) setOpen(false);
        }}
        title={`Marcar cuota ${n} como pagada`}
        description={`Se registrará un pago de ${fmtPEN(monto)} en Caja y la cuota quedará pagada.`}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={`metodo-pago-${cuotaId}`} className="text-xs font-medium text-muted-foreground">
              Método de pago
            </label>
            <Select
              id={`metodo-pago-${cuotaId}`}
              value={metodo}
              onChange={(e) => setMetodo(e.target.value)}
            >
              {METODOS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={procesando}>
              Cancelar
            </Button>
            <Button onClick={() => void pagar()} disabled={procesando}>
              {procesando ? "Procesando…" : "Sí, marcar pagada"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
