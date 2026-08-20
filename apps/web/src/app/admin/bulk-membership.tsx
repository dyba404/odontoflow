"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BulkMembership({
  tenantId,
  tenantName,
}: {
  tenantId: string;
  tenantName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pending, start] = useTransition();
  const [incluirOwner, setIncluirOwner] = useState(false);

  function ejecutar() {
    start(async () => {
      const res = await fetch("/api/admin/memberships/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, active: false, motivo: motivo.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`${j.error ?? "error"}`);
        return;
      }
      toast.success(`Membresías de ${tenantName} desactivadas (${j.afectadas})`);
      window.dispatchEvent(new Event("of-miembros-cambiados"));
      setOpen(false);
      setMotivo("");
      setIncluirOwner(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserRoundX className="size-3.5" />
        Suspender membresías
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Suspender membresías de ${tenantName}`}
        description="Desactiva todas las membresías activas. El tenant no podrá entrar a su consola hasta que se reactiven."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`motivo-bulk-${tenantId}`}>Motivo (obligatorio)</Label>
            <Input
              id={`motivo-bulk-${tenantId}`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={200}
              placeholder="Ej. falta de pago del periodo 08/2026"
            />
          </div>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={incluirOwner}
              onChange={(e) => setIncluirOwner(e.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            Entiendo que esto incluye la membresía del owner: nadie entrará a la consola hasta
            reactivarla desde esta misma pantalla.
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending || motivo.trim().length === 0 || !incluirOwner}
            onClick={ejecutar}
          >
            {pending ? "Aplicando…" : "Suspender todas"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
