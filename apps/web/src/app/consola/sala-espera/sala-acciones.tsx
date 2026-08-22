"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const SALA_ESTADOS = [
  { id: "anunciado", label: "Anunciado" },
  { id: "en_box", label: "En consultorio" },
  { id: "en_espera_pago", label: "Esperando pago" },
  { id: "atendido", label: "Atendido" },
  { id: "retirado", label: "Retirado" },
] as const;

export function SalaAcciones({
  citaId,
  salaEstado,
  room,
}: {
  citaId: string;
  salaEstado: string | null;
  room: string | null;
}) {
  const [consultorio, setConsultorio] = useState(room ?? "");
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  async function cambiar(estado: string) {
    setCargando(true);
    try {
      const r = await fetch(`/api/citas/${citaId}/sala`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salaEstado: estado,
          room: estado === "en_box" ? consultorio || "1" : undefined,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error === "consultorio_requerido" ? "Elige consultorio" : "No se pudo actualizar");
        return;
      }
      router.refresh();
    } finally {
      setCargando(false);
    }
  }

  async function retirar() {
    setCargando(true);
    try {
      await fetch(`/api/citas/${citaId}/sala`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salaEstado: null }),
      });
      router.refresh();
    } finally {
      setCargando(false);
    }
  }

  if (salaEstado) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
          {SALA_ESTADOS.find((s) => s.id === salaEstado)?.label ?? salaEstado}
          {room ? ` · Box ${room}` : ""}
        </span>
        <Button size="sm" variant="outline" disabled={cargando} onClick={retirar}>
          Quitar de sala
        </Button>
        {cargando ? <Loader2 className="size-3.5 animate-spin" /> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SALA_ESTADOS.slice(0, 2).map((s) => (
        <Button key={s.id} size="sm" variant="outline" disabled={cargando} onClick={() => cambiar(s.id)}>
          {s.label}
        </Button>
      ))}
      <input
        value={consultorio}
        onChange={(e) => setConsultorio(e.target.value)}
        placeholder="Box"
        className="h-7 w-14 rounded-md border border-input bg-transparent px-2 text-xs outline-none [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-20 [@media(pointer:coarse)]:text-sm"
      />
      {cargando ? <Loader2 className="size-3.5 animate-spin" /> : null}
    </div>
  );
}
