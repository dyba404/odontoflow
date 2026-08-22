"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const PLANTILLAS: Array<{ id: string; label: string; texto: string }> = [
  {
    id: "confirmacion",
    label: "Confirmación de cita",
    texto:
      "Hola 👋 Te recordamos tu cita de mañana. Responde SI para confirmar o escríbenos si necesitas reprogramar.",
  },
  {
    id: "llegada",
    label: "Indicaciones de llegada",
    texto:
      "Hola 👋 Te esperamos hoy en la clínica. Por favor llega 10 minutos antes. Si tienes alguna duda, responde este mensaje.",
  },
  {
    id: "postoperatorio",
    label: "Seguimiento post-operatorio",
    texto:
      "Hola 👋 ¿Cómo te sientes después de tu tratamiento? Si presentas alguna molestia fuera de lo esperado, avísanos por este medio.",
  },
];

export function ResponderButton({
  waId,
  patientId,
  patientNombre,
}: {
  waId: string;
  patientId: string | null;
  patientNombre: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="size-3.5" />
        Responder
      </Button>
      {open ? (
        <ResponderDialog
          waId={waId}
          patientId={patientId}
          patientNombre={patientNombre}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ResponderDialog({
  waId,
  patientId,
  patientNombre,
  onClose,
}: {
  waId: string;
  patientId: string | null;
  patientNombre: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [texto, setTexto] = useState("");
  const [plantillaActiva, setPlantillaActiva] = useState<string | null>(null);

  function aplicarPlantilla(id: string) {
    const p = PLANTILLAS.find((x) => x.id === id);
    if (!p) return;
    setTexto(p.texto);
    setPlantillaActiva(id);
  }

  function onSubmit() {
    const cuerpo = texto.trim();
    if (!cuerpo) return;
    start(async () => {
      const r = await fetch("/api/whatsapp/mensajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waId, patientId, texto: cuerpo }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(`No se pudo enviar el mensaje: ${j.error ?? "error"}`);
        return;
      }
      toast.success("Mensaje enviado por WhatsApp");
      onClose();
      setTimeout(() => router.refresh(), 300);
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Responder por WhatsApp"
      icon={<MessageCircle className="size-4 text-primary" />}
      description={
        patientNombre
          ? `Para ${patientNombre} (${waId})`
          : `Para el número ${waId}`
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Plantillas rápidas</Label>
          <div className="flex flex-wrap gap-1.5">
            {PLANTILLAS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => aplicarPlantilla(p.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  plantillaActiva === p.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="wa-respuesta">Mensaje</Label>
          <Textarea
            id="wa-respuesta"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setPlantillaActiva(null);
            }}
            maxLength={1000}
            rows={4}
            placeholder="Escribe tu respuesta…"
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" onClick={onSubmit} disabled={pending || !texto.trim()}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <Send className="size-4" />
                Enviar
              </>
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
