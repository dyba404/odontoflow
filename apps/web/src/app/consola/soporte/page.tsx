import { LifeBuoy, Mail, MessageSquare, BookOpen, CalendarDays, Wallet, Globe, ChevronDown } from "lucide-react";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { getDefaultTeam } from "@/lib/console-data";

export const dynamic = "force-dynamic";

export default async function SoportePage() {
  const team = await getDefaultTeam();
  if (!team) redirect("/login");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Centro de ayuda"
        description="Guías rápidas, contacto y estado del servicio."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-3 p-5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Mail className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">Soporte por correo</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Respuesta en menos de 24 horas hábiles.
              </p>
            </div>
            <a
              href="mailto:soporte@odontoflow.pe"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              soporte@odontoflow.pe
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <MessageSquare className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">WhatsApp</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Lunes a sábado, de 9am a 7pm.
              </p>
            </div>
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
              +51 999 888 777
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <LifeBuoy className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">Estado del servicio</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Todos los sistemas operativos.
              </p>
            </div>
            <Badge variant="green">Operativo</Badge>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
          <BookOpen className="size-4 text-muted-foreground" />
          Guías para empezar
        </h3>
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="divide-y divide-border-subtle">
            <Guide
              icon={CalendarDays}
              title="Cómo confirmar una solicitud de cita"
              detail="Revisa la cola, asigna doctor y hora, y confirma en un clic."
              pasos={[
                "Abre Solicitudes en el menú: ahí aparecen los pedidos que enviaron tus pacientes por la página pública.",
                "Revisa paciente, servicio, fecha y doctor preferido. Si el horario no funciona, usa Rechazar y el paciente recibirá un correo para reelegir.",
                "Pulsa Confirmar para asignar la cita al doctor y horario elegidos.",
                "Al confirmar, el paciente recibe automáticamente un correo con la confirmación y un enlace para reprogramar o cancelar.",
              ]}
            />
            <Guide
              icon={Wallet}
              title="Registrar un pago en caja"
              detail="Yape, Plin, efectivo o POS. El total del día se cuadra solo."
              pasos={[
                "Abre Caja del día y pulsa Registrar pago: elige el paciente o la cita atendida.",
                "Ingresa el monto y el método: Yape, Plin, efectivo, tarjeta POS o tarjeta online.",
                "Añade la referencia u operación del pago para cuadrar con tu billetera o POS.",
                "El total del día se actualiza solo. Al cerrar el día, haz el Cierre de caja para dejar registrado el cuadre.",
              ]}
            />
            <Guide
              icon={Globe}
              title="Compartir tu página de reservas"
              detail="Envía tu enlace público a pacientes y redes sociales."
              pasos={[
                "Tu página pública es: tu-dominio/seguido del nombre corto de tu clínica (el slug) y /reserva.",
                "Comparte el enlace por WhatsApp y añádelo a tus perfiles de Instagram, Facebook y Google.",
                "El paciente elige el servicio, la fecha y la hora, y envía su solicitud.",
                "Cada solicitud llega a la cola de Solicitudes para que tu equipo la confirme.",
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Guide({
  icon: Icon,
  title,
  detail,
  pasos,
}: {
  icon: typeof Mail;
  title: string;
  detail: string;
  pasos: string[];
}) {
  return (
    <details className="group">
      <summary className="flex w-full cursor-pointer list-none items-center gap-4 p-4 text-left transition-colors duration-150 hover:bg-surface-hover [&::-webkit-details-marker]:hidden">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
        <Badge variant="gray">Guía</Badge>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <ol className="space-y-2 px-4 pb-5 pl-16">
        {pasos.map((paso, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground tabular-nums">
              {i + 1}
            </span>
            <span>{paso}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
