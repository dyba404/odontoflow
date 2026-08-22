"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export interface OpcionRepresentante {
  id: string;
  nombre: string;
}

export function RepresentanteDialog({
  patientId,
  pacienteNombre,
  representanteId,
  opciones,
}: {
  patientId: string;
  pacienteNombre: string;
  representanteId: string | null;
  opciones: OpcionRepresentante[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<string>(representanteId ?? "");

  function onSubmit() {
    start(async () => {
      const res = await fetch(`/api/pacientes/${patientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ representanteId: sel || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo guardar el representante: ${j.error ?? "error"}`);
        return;
      }
      toast.success("Representante actualizado");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Users className="size-4" />
        Representante
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Representante / tutor"
        icon={<Users className="size-4 text-primary" />}
        description={`El representante de ${pacienteNombre} puede ver y gestionar su portal (citas, pagos, ficha).`}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rep-select">Paciente representante</Label>
            <select
              id="rep-select"
              value={sel}
              onChange={(e) => setSel(e.target.value)}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Sin representante</option>
              {opciones.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Por ejemplo, un padre/madre para un paciente menor de edad.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={onSubmit} disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
