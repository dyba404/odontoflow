"use client";

import { useState, useTransition } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function PortalLinkButton({ patientId }: { patientId: string }) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);

  function generar() {
    start(async () => {
      const response = await fetch(`/api/pacientes/${patientId}/portal`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body.url !== "string") {
        toast.error(`No se pudo generar el enlace: ${body.error ?? "error"}`);
        return;
      }
      setLink(body.url);
      await navigator.clipboard?.writeText(body.url).catch(() => undefined);
      toast.success("Enlace del portal copiado");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={generar} disabled={pending}>
        <Link2 className="size-4" />
        {pending ? "Generando…" : "Portal del paciente"}
      </Button>
      {link ? (
        <button
          type="button"
          className="max-w-full truncate text-xs font-medium text-primary underline underline-offset-2"
          title={link}
          onClick={() => {
            void navigator.clipboard?.writeText(link).then(
              () => toast.success("Enlace copiado"),
              () => toast.error("No se pudo copiar"),
            );
          }}
        >
          Copiar enlace
        </button>
      ) : null}
    </div>
  );
}