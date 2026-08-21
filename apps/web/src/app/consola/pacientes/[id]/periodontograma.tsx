"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, History } from "lucide-react";

type Registro = {
  id: string;
  nota: string | null;
  creadoEl: string;
};

export function Periodontograma({
  patientId,
  canEdit,
  registros,
}: {
  patientId: string;
  canEdit: boolean;
  registros: Registro[];
}) {
  const [lista, setLista] = useState(registros);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardarSnapshot() {
    if (guardando) return;
    const mod = await import("@/vendor/react-advanced-odontogram");
    if (!mod.hasAnyPerioData()) {
      toast.error("No hay datos periodontales registrados. Completa el sondaje en la vista de periodontograma del odontograma.");
      return;
    }
    setGuardando(true);
    try {
      const r = await fetch(`/api/pacientes/${patientId}/periodontograma`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot: mod.getStatusChart(), nota: nota || null }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        toast.error(`No se pudo guardar el snapshot: ${j.error ?? "error"}`);
        return;
      }
      const ok = (await r.json()) as { id: string | null };
      setLista((prev) => [
        { id: ok.id ?? "", snapshot: null, nota: nota || null, creadoEl: new Date().toISOString() },
        ...prev,
      ]);
      setNota("");
      toast.success("Snapshot periodontal guardado");
    } catch {
      toast.error("No se pudo guardar el snapshot");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3">
      {canEdit ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Ve al modo Periodontograma dentro del editor del odontograma para cargar
            sondaje, furcaciones y movilidad. Aquí se guardan como snapshots inmutables.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Nota del episodio (opcional)"
              maxLength={2000}
              className="h-8 w-56 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
            />
            <Button size="sm" variant="outline" onClick={guardarSnapshot} disabled={guardando}>
              {guardando ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Guardando…
                </>
              ) : (
                "Guardar snapshot"
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {lista.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
          <History className="size-4" />
          Sin episodios periodontales registrados todavía.
        </div>
      ) : (
        <ul className="space-y-2">
          {lista.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-lg border p-3 text-xs">
              <span className="font-medium">
                {new Date(r.creadoEl).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" })}
              </span>
              <span className="text-muted-foreground">{r.nota ?? "—"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
