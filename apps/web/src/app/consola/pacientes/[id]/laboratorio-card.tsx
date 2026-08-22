"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRight, FlaskConical, Plus, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { fmtPEN } from "@/lib/format";

export type PedidoLab = {
  id: string;
  tipo: string;
  laboratorio: string | null;
  fechaPromesa: string | null;
  costo: string;
  estado: string;
  notas?: string | null;
  createdAt: string | Date;
};

const ESTADOS = ["enviado", "fabricacion", "recibido", "colocado"] as const;
const SIGUIENTE: Record<string, string | null> = {
  enviado: "fabricacion",
  fabricacion: "recibido",
  recibido: "colocado",
  colocado: null,
  cancelado: null,
};
const ETIQUETA: Record<string, string> = {
  enviado: "Enviado",
  fabricacion: "En fabricación",
  recibido: "Recibido",
  colocado: "Colocado",
  cancelado: "Cancelado",
};
const BADGE: Record<string, "amber" | "blue" | "teal" | "green" | "red"> = {
  enviado: "amber",
  fabricacion: "blue",
  recibido: "teal",
  colocado: "green",
  cancelado: "red",
};

function Stepper({ estado }: { estado: string }) {
  if (estado === "cancelado") return null;
  const idx = ESTADOS.indexOf(estado as (typeof ESTADOS)[number]);
  return (
    <div className="flex items-center gap-1">
      {ESTADOS.map((s, i) => (
        <span key={s} className="flex items-center gap-1">
          <span
            className={`size-2 rounded-full ${i <= idx ? "bg-primary" : "bg-muted-foreground/30"}`}
            title={ETIQUETA[s]}
          />
          {i < ESTADOS.length - 1 ? (
            <span className={`h-px w-4 ${i < idx ? "bg-primary" : "bg-muted-foreground/30"}`} />
          ) : null}
        </span>
      ))}
    </div>
  );
}

export function LaboratorioCard({
  patientId,
  pedidoInicial,
  canEdit,
  servicios,
}: {
  patientId: string;
  pedidoInicial: PedidoLab[];
  canEdit: boolean;
  servicios: string[];
}) {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<PedidoLab[]>(pedidoInicial);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [tipoSel, setTipoSel] = useState("");
  const [tipoOtro, setTipoOtro] = useState("");
  const [laboratorio, setLaboratorio] = useState("");
  const [fechaPromesa, setFechaPromesa] = useState("");
  const [costo, setCosto] = useState("");
  const [notas, setNotas] = useState("");

  function abrir() {
    setTipoSel(servicios[0] ?? "__otro");
    setTipoOtro("");
    setLaboratorio("");
    setFechaPromesa("");
    setCosto("");
    setNotas("");
    setOpen(true);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const tipo = (tipoSel === "__otro" ? tipoOtro : tipoSel).trim();
    if (!tipo) {
      toast.error("Indica el tipo de trabajo (ej. Corona zirconio 16).");
      return;
    }
    start(async () => {
      const res = await fetch(`/api/pacientes/${patientId}/laboratorio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          laboratorio: laboratorio.trim() || undefined,
          fechaPromesa: fechaPromesa || undefined,
          costo: costo ? Number(costo) : undefined,
          notas: notas.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo crear el pedido: ${j.error ?? "error"}`);
        return;
      }
      setPedidos((prev) => [
        {
          id: j.id,
          tipo,
          laboratorio: laboratorio.trim() || null,
          fechaPromesa: fechaPromesa || null,
          costo: costo ? String(Number(costo)) : "0",
          estado: j.estado ?? "enviado",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      toast.success("Pedido de laboratorio creado.");
      setOpen(false);
      router.refresh();
    });
  }

  function cambiarEstado(id: string, estado: string) {
    start(async () => {
      const res = await fetch(`/api/laboratorio/${id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo actualizar el estado: ${j.error ?? "error"}`);
        return;
      }
      setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, estado: j.estado } : p)));
      toast.success(`Estado actualizado a ${ETIQUETA[j.estado] ?? j.estado}.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {pedidos.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          Sin pedidos de laboratorio todavía.
        </p>
      ) : (
        <ul className="divide-y">
          {pedidos.map((p) => {
            const siguiente = SIGUIENTE[p.estado] ?? null;
            return (
              <li key={p.id} className="space-y-2 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.tipo}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.laboratorio ?? "Laboratorio sin definir"}
                      {p.fechaPromesa
                        ? ` · Promesa: ${format(new Date(`${p.fechaPromesa}T12:00:00`), "d MMM yyyy", { locale: es })}`
                        : ""}
                    </p>
                    {p.notas ? <p className="mt-0.5 text-xs text-muted-foreground">{p.notas}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge variant={BADGE[p.estado] ?? "gray"}>{ETIQUETA[p.estado] ?? p.estado}</Badge>
                    <span className="text-xs font-semibold tabular-nums">{fmtPEN(Number(p.costo))}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Stepper estado={p.estado} />
                  {canEdit ? (
                    <div className="flex items-center gap-1.5">
                      {siguiente ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={pending}
                          onClick={() => cambiarEstado(p.id, siguiente)}
                        >
                          <ArrowRight className="size-3.5" />
                          {ETIQUETA[siguiente]}
                        </Button>
                      ) : null}
                      {p.estado !== "cancelado" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground"
                          disabled={pending}
                          onClick={() => cambiarEstado(p.id, "cancelado")}
                        >
                          <XCircle className="size-3.5" />
                          Cancelar
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canEdit ? (
        <Button type="button" variant="outline" size="sm" onClick={abrir}>
          <Plus className="size-4" />
          Nuevo pedido
        </Button>
      ) : null}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo pedido de laboratorio"
        icon={<FlaskConical className="size-4 text-primary" />}
        description="Registra el trabajo enviado al protésico."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Trabajo</Label>
            {servicios.length > 0 ? (
              <Select value={tipoSel} onChange={(e) => setTipoSel(e.target.value)}>
                {servicios.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value="__otro">Otro (escribir)</option>
              </Select>
            ) : (
              <Input
                value={tipoOtro}
                onChange={(e) => setTipoOtro(e.target.value)}
                maxLength={60}
                placeholder="Corona zirconio 16"
              />
            )}
          </div>

          {servicios.length > 0 && tipoSel === "__otro" ? (
            <div className="space-y-1.5">
              <Label>Descripción del trabajo</Label>
              <Input
                value={tipoOtro}
                onChange={(e) => setTipoOtro(e.target.value)}
                maxLength={60}
                placeholder="Corona zirconio 16"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>Laboratorio</Label>
            <Input
              value={laboratorio}
              onChange={(e) => setLaboratorio(e.target.value)}
              maxLength={120}
              placeholder="Nombre del laboratorio (opcional)"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Fecha de promesa</Label>
              <Input
                type="date"
                value={fechaPromesa}
                onChange={(e) => setFechaPromesa(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Costo (S/)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                placeholder="0.00"
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
              placeholder="Indicaciones para el laboratorio…"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Crear pedido"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
