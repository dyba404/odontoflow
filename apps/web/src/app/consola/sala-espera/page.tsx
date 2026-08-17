import type { AppointmentStatus } from "@odontoflow/core";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { AvanzarEstado } from "@/app/consola/sala-espera/avanzar-estado";
import { AutoRefresh } from "@/app/consola/sala-espera/auto-refresh";
import { getDefaultTeam, citasDelDia, doctoresConColor } from "@/lib/console-data";

export const dynamic = "force-dynamic";

function hoyLima(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}

interface Columna {
  key: string;
  titulo: string;
  estado: AppointmentStatus;
  siguiente: AppointmentStatus;
  label: string;
  vacio: string;
}

const COLUMNAS: Columna[] = [
  {
    key: "por_llegar",
    titulo: "Por llegar",
    estado: "confirmada",
    siguiente: "en_espera",
    label: "Llegó",
    vacio: "Sin pacientes por llegar",
  },
  {
    key: "en_sala",
    titulo: "En sala",
    estado: "en_espera",
    siguiente: "en_atencion",
    label: "Llamar",
    vacio: "Sala de espera vacía",
  },
  {
    key: "en_atencion",
    titulo: "En atención",
    estado: "en_atencion",
    siguiente: "atendida",
    label: "Finalizar",
    vacio: "Nadie en atención",
  },
];

export default async function SalaEsperaPage() {
  const team = await getDefaultTeam();
  if (!team) redirect("/login");

  const [citas, doctores] = await Promise.all([
    citasDelDia(team.id, hoyLima()),
    doctoresConColor(team.id),
  ]);

  const enFila = citas.filter((c) =>
    ["confirmada", "en_espera", "en_atencion"].includes(c.estado),
  );
  const atendidas = citas.filter((c) => c.estado === "atendida").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Sala de espera"
        description={`Kanban en tiempo real. ${enFila.length} en fila · ${atendidas} atendidas hoy. Nunca visible para pacientes.`}
      />

      <AutoRefresh>
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNAS.map((col) => {
            const items = enFila.filter((c) => c.estado === col.estado);
            return (
              <section
                key={col.key}
                className="flex flex-col rounded-2xl border bg-muted/30"
              >
                <header className="flex items-center justify-between gap-2 p-4 pb-3">
                  <h3 className="text-sm font-semibold">{col.titulo}</h3>
                  <Badge variant="gray" className="tabular-nums">
                    {items.length}
                  </Badge>
                </header>
                <div className="flex flex-1 flex-col gap-3 px-3 pb-3">
                  {items.length === 0 ? (
                    <div className="flex min-h-[96px] flex-1 items-center justify-center rounded-xl border border-dashed px-4 text-center text-sm text-muted-foreground">
                      {col.vacio}
                    </div>
                  ) : (
                    items.map((c) => {
                      const doc = doctores.find((d) => d.id === c.doctorId);
                      return (
                        <Card key={c.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold tabular-nums">
                                {c.horaIni.slice(0, 5)}
                              </span>
                              {doc ? (
                                <span
                                  className="size-2.5 rounded-full"
                                  style={{ background: doc.color }}
                                  title={doc.name}
                                />
                              ) : null}
                            </div>
                            <p className="mt-1 truncate text-sm font-semibold">
                              {c.patientNombre}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {c.servicio}
                            </p>
                            <div className="mt-3">
                              <AvanzarEstado
                                citaId={c.id}
                                paciente={c.patientNombre}
                                de={c.estado as AppointmentStatus}
                                a={col.siguiente}
                                label={col.label}
                                className="w-full"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </AutoRefresh>
    </div>
  );
}
