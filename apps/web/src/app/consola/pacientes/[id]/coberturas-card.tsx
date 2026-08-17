"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type Cobertura = {
  id: string;
  plan: string | null;
  copagoPct: string;
  vigenteDesde: string | null;
  vigenteHasta: string | null;
  activo: boolean;
  notas: string | null;
  insurerNombre: string;
};

function fmtVigencia(fecha: string): string {
  return format(new Date(`${fecha}T12:00:00`), "d MMM yyyy", { locale: es });
}

function textoVigencia(c: Cobertura): string {
  if (c.vigenteDesde && c.vigenteHasta) {
    return `${fmtVigencia(c.vigenteDesde)} – ${fmtVigencia(c.vigenteHasta)}`;
  }
  if (c.vigenteDesde) return `Desde ${fmtVigencia(c.vigenteDesde)}`;
  if (c.vigenteHasta) return `Hasta ${fmtVigencia(c.vigenteHasta)}`;
  return "Sin vigencia definida";
}

export function CoberturasCard({
  patientId,
  coberturas,
  aseguradoras,
  canEdit,
}: {
  patientId: string;
  coberturas: Cobertura[];
  aseguradoras: Array<{ id: string; nombre: string }>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [lista, setLista] = useState<Cobertura[]>(coberturas);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [insurerSel, setInsurerSel] = useState("");
  const [plan, setPlan] = useState("");
  const [copago, setCopago] = useState("");
  const [vigenteDesde, setVigenteDesde] = useState("");
  const [vigenteHasta, setVigenteHasta] = useState("");
  const [notas, setNotas] = useState("");

  function abrir() {
    setInsurerSel(aseguradoras[0]?.id ?? "");
    setPlan("");
    setCopago("");
    setVigenteDesde("");
    setVigenteHasta("");
    setNotas("");
    setOpen(true);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!insurerSel) {
      toast.error("Selecciona una aseguradora.");
      return;
    }
    const copagoNum = copago === "" ? 0 : Number(copago);
    if (!Number.isFinite(copagoNum) || copagoNum < 0 || copagoNum > 100) {
      toast.error("El copago debe estar entre 0 y 100%.");
      return;
    }
    if (vigenteDesde && vigenteHasta && vigenteDesde > vigenteHasta) {
      toast.error("La vigencia inicial no puede ser posterior a la final.");
      return;
    }

    start(async () => {
      const res = await fetch(`/api/pacientes/${patientId}/coberturas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insurerId: insurerSel,
          plan: plan.trim() || undefined,
          copagoPct: copagoNum,
          vigenteDesde: vigenteDesde || undefined,
          vigenteHasta: vigenteHasta || undefined,
          notas: notas.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo crear la cobertura: ${j.error ?? "error"}`);
        return;
      }
      const nueva = j.cobertura as Cobertura | undefined;
      if (nueva) {
        setLista((prev) => [nueva, ...prev]);
      } else {
        router.refresh();
      }
      toast.success("Cobertura registrada.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {lista.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          Sin coberturas de seguro todavía.
        </p>
      ) : (
        <ul className="divide-y">
          {lista.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="blue">{c.insurerNombre}</Badge>
                  <Badge variant={c.activo ? "green" : "gray"}>
                    {c.activo ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {c.plan ?? "Sin plan"} · Copago {Number(c.copagoPct)}%
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{textoVigencia(c)}</p>
                {c.notas ? <p className="mt-0.5 text-xs text-muted-foreground">{c.notas}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <Button type="button" variant="outline" size="sm" onClick={abrir} disabled={aseguradoras.length === 0}>
          <Plus className="size-4" />
          Nueva cobertura
        </Button>
      ) : null}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva cobertura"
        icon={<ShieldCheck className="size-4 text-primary" />}
        description="Vincula una aseguradora o EPS a este paciente."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Aseguradora</Label>
            {aseguradoras.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No hay aseguradoras registradas. Créalas en Consola → Aseguradoras.
              </p>
            ) : (
              <Select value={insurerSel} onChange={(e) => setInsurerSel(e.target.value)}>
                {aseguradoras.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Input
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              maxLength={120}
              placeholder="Plan dental full (opcional)"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Copago (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={copago}
              onChange={(e) => setCopago(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Vigente desde</Label>
              <Input
                type="date"
                value={vigenteDesde}
                onChange={(e) => setVigenteDesde(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vigente hasta</Label>
              <Input
                type="date"
                value={vigenteHasta}
                onChange={(e) => setVigenteHasta(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <textarea
              className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              rows={3}
              maxLength={500}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Coberturas, límites, autorizaciones…"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || aseguradoras.length === 0}>
              {pending ? "Guardando…" : "Crear cobertura"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
