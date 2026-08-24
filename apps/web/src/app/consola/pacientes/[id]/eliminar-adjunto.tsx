"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function EliminarAdjunto({
  adjuntoId,
  nombre,
}: {
  adjuntoId: string;
  nombre: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  function eliminar() {
    start(async () => {
      const r = await fetch(`/api/adjuntos/${adjuntoId}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(
          (j as { error?: string }).error === "adjunto_en_uso"
            ? "No se puede eliminar: el archivo está vinculado a un documento firmado."
            : `No se pudo eliminar el archivo: ${(j as { error?: string }).error ?? "error"}`,
        );
        return;
      }
      setOpen(false);
      toast.success("Archivo eliminado.");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Eliminar ${nombre}`}
        title="Eliminar"
        className="size-7 text-red-600 hover:text-red-700"
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        <Trash2 className="size-3.5" />
      </Button>

      <Dialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title="Eliminar archivo"
        icon={<Trash2 className="size-4 text-red-600" />}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Se eliminará <span className="font-medium text-foreground">{nombre}</span> y sus
            miniaturas. Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={eliminar}
              disabled={pending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              <Trash2 className="size-3.5" />
              {pending ? "Eliminando…" : "Sí, eliminar"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
