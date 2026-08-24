"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface SlotInfo {
  startTime: string;
  endTime: string;
}

export function CitaActions({
  citaId,
  paciente,
  doctorId,
  fecha,
  horaIni,
  doctores,
  servicio,
  serviceId,
  slug,
}: {
  citaId: string;
  paciente: string;
  doctorId: string | null;
  fecha: string;
  horaIni: string;
  doctores: Array<{ id: string; name: string; color?: string }>;
  servicio?: string;
  serviceId?: string;
  slug?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [nFecha, setNFecha] = useState(fecha);
  const [nHora, setNHora] = useState(horaIni.slice(0, 5));
  const [nDoctorId, setNDoctorId] = useState(doctorId ?? "");

  const horaActual = horaIni.slice(0, 5);

  // ---- Horarios libres (misma API que la reserva pública) ----
  const [slots, setSlots] = useState<SlotInfo[] | null>(null);
  const [slotsCargando, setSlotsCargando] = useState(false);

  useEffect(() => {
    if (!open || !serviceId || !slug || !nFecha) {
      setSlots(null);
      return;
    }
    let cancelado = false;
    setSlotsCargando(true);
    const params = new URLSearchParams({ serviceId, date: nFecha });
    if (nDoctorId) params.set("doctorId", nDoctorId);
    params.set("excluirCitaId", citaId);
    fetch(`/api/clinicas/${slug}/slots?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { slots?: SlotInfo[] }) => {
        if (!cancelado) setSlots(j.slots ?? []);
      })
      .catch(() => {
        if (!cancelado) setSlots(null);
      })
      .finally(() => {
        if (!cancelado) setSlotsCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [open, nFecha, nDoctorId, serviceId, slug, citaId]);

  // Validación en vivo del input manual: la hora debe estar entre los libres
  // (o ser la hora actual de la cita). No bloquea: el backend decide al guardar.
  const ocupado =
    slots !== null && !slotsCargando && nHora !== "" && nHora !== horaActual &&
    !slots.some((s) => s.startTime.slice(0, 5) === nHora);

  function reprogramar(e: FormEvent) {
    e.preventDefault();
    if (!nFecha || !nHora) {
      toast.error("Completa fecha y hora");
      return;
    }
    start(async () => {
      const r = await fetch(`/api/citas/${citaId}/reprogramar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: nFecha,
          horaIni: nHora,
          doctorId: nDoctorId || null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(
          j.error === "horario_ocupado"
            ? "El horario elegido está ocupado"
            : `No se pudo reprogramar: ${j.error ?? "error"}`,
        );
        return;
      }
      toast.success(`Cita de ${paciente} reprogramada`);
      setOpen(false);
      setTimeout(() => router.refresh(), 300);
    });
  }

  function cancelar() {
    setConfirmar(false);
    start(async () => {
      const r = await fetch(`/api/citas/${citaId}/estado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "cancelada" }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(`No se pudo cancelar: ${j.error ?? "error"}`);
        return;
      }
      toast.success(`Cita de ${paciente} cancelada`);
      setTimeout(() => router.refresh(), 300);
    });
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="size-7 [@media(pointer:coarse)]:min-w-12"
          title="Reprogramar"
          aria-label={`Reprogramar cita de ${paciente}`}
          onClick={() => {
            setNFecha(fecha);
            setNHora(horaActual);
            setNDoctorId(doctorId ?? "");
            setOpen(true);
          }}
          disabled={pending}
        >
          <CalendarClock className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7 [@media(pointer:coarse)]:min-w-12"
          title="Cancelar"
          aria-label={`Cancelar cita de ${paciente}`}
          onClick={() => setConfirmar(true)}
          disabled={pending}
        >
          <X className="size-3.5 text-destructive" />
        </Button>
      </div>

      {open
        ? createPortal(
            <Dialog
              open={open}
              onClose={() => setOpen(false)}
              title="Reprogramar cita"
              icon={<CalendarClock className="size-4 text-primary" />}
              description={`${paciente}${servicio ? ` · ${servicio}` : ""} · actual ${horaActual}`}
            >
              <form onSubmit={reprogramar} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label
                      className="text-xs font-medium text-muted-foreground"
                      htmlFor={`reprog-fecha-${citaId}`}
                    >
                      Fecha
                    </label>
                    <Input
                      id={`reprog-fecha-${citaId}`}
                      type="date"
                      value={nFecha}
                      onChange={(e) => setNFecha(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      className="text-xs font-medium text-muted-foreground"
                      htmlFor={`reprog-hora-${citaId}`}
                    >
                      Hora
                    </label>
                    <Input
                      id={`reprog-hora-${citaId}`}
                      type="time"
                      className={cn(
                        "tabular-nums",
                        ocupado && "border-destructive focus-visible:ring-destructive",
                      )}
                      value={nHora}
                      onChange={(e) => setNHora(e.target.value)}
                      required
                    />
                  </div>
                </div>
                {ocupado ? (
                  <p className="text-xs text-destructive">
                    Ese horario no está disponible (puedes guardarlo y el sistema lo validará).
                  </p>
                ) : null}

                {serviceId && slug ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Horarios libres</p>
                    {slotsCargando ? (
                      <p className="text-xs text-muted-foreground">Buscando horarios…</p>
                    ) : slots === null ? (
                      <p className="text-xs text-muted-foreground">
                        Escribe la hora manualmente arriba.
                      </p>
                    ) : slots.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No hay horarios libres con esos filtros; usa el campo de hora.
                      </p>
                    ) : (
                      <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-md border bg-muted/20 p-2">
                        {nHora !== horaActual ? (
                          <button
                            key="__actual"
                            type="button"
                            onClick={() => setNHora(horaActual)}
                            className="rounded-full border border-dashed px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            title="Volver a la hora actual de la cita"
                          >
                            Actual {horaActual}
                          </button>
                        ) : null}
                        {slots.map((s) => {
                          const h = s.startTime.slice(0, 5);
                          const sel = nHora === h;
                          return (
                            <button
                              key={s.startTime}
                              type="button"
                              onClick={() => setNHora(h)}
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                                sel
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-card hover:bg-accent hover:text-foreground",
                              )}
                            >
                              {h}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <label
                    className="text-xs font-medium text-muted-foreground"
                    htmlFor={`reprog-doctor-${citaId}`}
                  >
                    Doctor
                  </label>
                  <Select
                    id={`reprog-doctor-${citaId}`}
                    value={nDoctorId}
                    onChange={(e) => setNDoctorId(e.target.value)}
                  >
                    <option value="">Sin doctor asignado</option>
                    {doctores.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={pending}>
                    <CalendarClock className="size-4" />
                    Guardar
                  </Button>
                </div>
              </form>
            </Dialog>,
            document.body,
          )
        : null}

      {confirmar
        ? createPortal(
            <Dialog
              open={confirmar}
              onClose={() => setConfirmar(false)}
              title="Cancelar cita"
              icon={<X className="size-4 text-destructive" />}
              description={`¿Cancelar la cita de ${paciente}? Quedará marcada como cancelada en la agenda.`}
            >
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmar(false)} disabled={pending}>
                  No, volver
                </Button>
                <Button variant="destructive" onClick={cancelar} disabled={pending}>
                  <X className="size-4" />
                  Sí, cancelar cita
                </Button>
              </div>
            </Dialog>,
            document.body,
          )
        : null}
    </>
  );
}
