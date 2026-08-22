"use client";

import { useState, useTransition } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ReferidoLinkButton({
  patientId,
  codigoInicial,
}: {
  patientId: string;
  codigoInicial: string | null;
}) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);

  function generar() {
    start(async () => {
      const response = await fetch(`/api/pacientes/${patientId}/referido`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body.url !== "string") {
        toast.error(`No se pudo generar el link: ${body.error ?? "error"}`);
        return;
      }
      setLink(body.url);
      await navigator.clipboard?.writeText(body.url).catch(() => undefined);
      toast.success(`Link de referido copiado (código ${body.codigo})`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={generar} disabled={pending}>
        <Share2 className="size-4" />
        {pending ? "Generando…" : "Link de referido"}
      </Button>
      {link ? (
        <button
          type="button"
          className="max-w-full truncate text-xs font-medium text-primary underline underline-offset-2"
          title={link}
          onClick={() => {
            void navigator.clipboard?.writeText(link).then(
              () => toast.success("Link copiado"),
              () => toast.error("No se pudo copiar"),
            );
          }}
        >
          Copiar link
        </button>
      ) : codigoInicial ? (
        <span className="text-xs text-muted-foreground">
          Código: <span className="font-mono">{codigoInicial}</span>
        </span>
      ) : null}
    </div>
  );
}
