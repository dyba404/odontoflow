import {
  LifeBuoy,
  Mail,
  MessageSquare,
  BookOpen,
  CalendarDays,
  Wallet,
  Globe,
  ChevronDown,
  Database,
  Receipt,
  MessageCircle,
  CreditCard,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getDb, whatsappSettings } from "@odontoflow/db";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { getDefaultTeam, suscripcionTeam } from "@/lib/console-data";
import { getSession } from "@/lib/auth";
import { mailConfigurado, mailEstadoHumano } from "@/lib/mail";
import { lycetConfigurado } from "@/lib/lycet";

export const dynamic = "force-dynamic";

async function checkDb(): Promise<boolean> {
  try {
    await Promise.race([
      getDb().execute(sql`select 1`),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
    ]);
    return true;
  } catch {
    return false;
  }
}

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  premium: "Premium",
};

const ESTADO_PLAN_LABEL: Record<string, string> = {
  activo: "Activo",
  por_renovar: "Por renovar",
  suspendido: "Suspendido",
  cancelado: "Cancelado",
};

function fmtVence(fecha: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${fecha}T12:00:00`));
}

export default async function SoportePage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  const [dbOk, waFila, sub] = await Promise.all([
    checkDb(),
    getDb()
      .select({
        activo: whatsappSettings.activo,
        phoneNumberId: whatsappSettings.phoneNumberId,
        tokenEnc: whatsappSettings.tokenEnc,
      })
      .from(whatsappSettings)
      .where(eq(whatsappSettings.tenantId, team.id))
      .limit(1)
      .then((r) => r[0] ?? null),
    suscripcionTeam(team.id),
  ]);

  const correoOk = mailConfigurado();
  const lycetOk = lycetConfigurado();
  const waOk = Boolean(waFila?.activo && waFila?.phoneNumberId && waFila?.tokenEnc);
  const servicios: Array<{
    icono: typeof Mail;
    titulo: string;
    detalle: string;
    ok: boolean | null;
  }> = [
    {
      icono: Database,
      titulo: "Base de datos",
      detalle: dbOk ? "Postgres conectado" : "Sin conexión",
      ok: dbOk,
    },
    {
      icono: Mail,
      titulo: "Correo (Resend/SMTP)",
      detalle: correoOk ? mailEstadoHumano() : "Sin credenciales",
      ok: correoOk,
    },
    {
      icono: Receipt,
      titulo: "Facturación electrónica (Lycet)",
      detalle: lycetOk ? "Sidecar configurado" : "Sin LYCET_URL",
      ok: lycetOk,
    },
    {
      icono: MessageCircle,
      titulo: "WhatsApp",
      detalle:
        waOk || !waFila
          ? waOk
            ? "Activo y completo"
            : "Sin configurar"
          : waFila.activo
            ? "Incompleto: falta ID de número o token"
            : "Inactivo",
      ok: waOk,
    },
  ];

  const todosOk = servicios.every((s) => s.ok);
  const planLabel = PLAN_LABEL[sub?.plan ?? "free"] ?? "Free";
  const estadoPlan = ESTADO_PLAN_LABEL[sub?.estado ?? "activo"] ?? sub?.estado;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Centro de ayuda"
        description="Guías rápidas, contacto y estado real del servicio."
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
                {todosOk
                  ? "Todos los sistemas operativos."
                  : "Algunos servicios requieren configuración."}
              </p>
            </div>
            {todosOk ? (
              <Badge variant="green">Operativo</Badge>
            ) : (
              <Badge variant="amber">Revisar configuración</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-5 pb-4">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4 text-primary" />
            Estado de los servicios
          </h3>
        </CardHeader>
        <CardContent className="space-y-3 p-5 pt-0">
          {servicios.map((s) => (
            <div key={s.titulo} className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                <s.icono className="size-4 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{s.titulo}</p>
                <p className="truncate text-xs text-muted-foreground">{s.detalle}</p>
              </div>
              {s.ok === false ? (
                <Badge variant="red">
                  <ShieldAlert className="size-3" />
                  Pendiente
                </Badge>
              ) : (
                <Badge variant="green">
                  <ShieldCheck className="size-3" />
                  OK
                </Badge>
              )}
            </div>
          ))}
          <div className="flex items-center gap-3 border-t pt-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
              <CreditCard className="size-4 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Suscripción</p>
              <p className="truncate text-xs text-muted-foreground">
                Plan {planLabel}
                {sub?.vence ? ` · vence el ${fmtVence(sub.vence)}` : ""}
                {sub?.nota ? ` · ${sub.nota}` : ""}
              </p>
            </div>
            <Badge
              variant={
                sub?.estado === "suspendido" || sub?.estado === "cancelado"
                  ? "red"
                  : sub?.estado === "por_renovar"
                    ? "amber"
                    : "green"
              }
            >
              {estadoPlan ?? "Activo"}
            </Badge>
          </div>
        </CardContent>
      </Card>

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
