import Link from "next/link";
import { Lock, MessageCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { and, count, desc, eq } from "drizzle-orm";
import { getDb, whatsappMessages, patients } from "@odontoflow/db";
import { hasPermission } from "@odontoflow/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSession } from "@/lib/auth";
import { getDefaultTeam } from "@/lib/console-data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LIMITE = 50;

export default async function WhatsAppPage({
  searchParams,
}: {
  searchParams: Promise<{ direccion?: string; offset?: string }>;
}) {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  if (!hasPermission(session.role, "patients.manage")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="WhatsApp"
          description="Bandeja de mensajes entrantes y salientes de WhatsApp."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Tu rol no tiene permiso para ver la bandeja de WhatsApp."
          />
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  const direccion = sp.direccion === "in" || sp.direccion === "out" ? sp.direccion : null;
  const offsetRaw = Number(sp.offset ?? "0");
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0;

  const db = getDb();
  const condiciones = [eq(whatsappMessages.tenantId, team.id)];
  if (direccion) condiciones.push(eq(whatsappMessages.direction, direccion));

  const [filas, [totalRow]] = await Promise.all([
    db
      .select({
        id: whatsappMessages.id,
        waId: whatsappMessages.waId,
        direction: whatsappMessages.direction,
        patientNombre: patients.nombre,
        phoneNumber: whatsappMessages.phoneNumber,
        body: whatsappMessages.body,
        estado: whatsappMessages.estado,
        error: whatsappMessages.error,
        createdAt: whatsappMessages.createdAt,
      })
      .from(whatsappMessages)
      .leftJoin(patients, eq(whatsappMessages.patientId, patients.id))
      .where(and(...condiciones))
      .orderBy(desc(whatsappMessages.createdAt), desc(whatsappMessages.id))
      .limit(LIMITE)
      .offset(offset),
    db.select({ total: count() }).from(whatsappMessages).where(and(...condiciones)),
  ]);

  const total = totalRow?.total ?? 0;
  const anterior = offset - LIMITE >= 0 ? offset - LIMITE : null;
  const siguiente = offset + LIMITE < total ? offset + LIMITE : null;
  const hrefPage = (nuevoOffset: number) => {
    const sp = new URLSearchParams();
    if (direccion) sp.set("direccion", direccion);
    if (nuevoOffset > 0) sp.set("offset", String(nuevoOffset));
    const q = sp.toString();
    return q ? `/consola/whatsapp?${q}` : "/consola/whatsapp";
  };
  const filtroHref = (d: string | null) =>
    d ? `/consola/whatsapp?direccion=${d}` : "/consola/whatsapp";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="WhatsApp"
        description={`${total} mensajes registrados en la bandeja.`}
        action={
          <div className="flex items-center gap-1 rounded-full border bg-card p-1">
            {([
              { v: null, label: "Todos" },
              { v: "in", label: "Entrantes" },
              { v: "out", label: "Salientes" },
            ] as const).map((o) => (
              <Link
                key={o.label}
                href={filtroHref(o.v)}
                className={cn(
                  direccion === o.v
                    ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                    : "rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {o.label}
              </Link>
            ))}
          </div>
        }
      />

      {filas.length === 0 ? (
        <Card>
          <EmptyState
            icon={MessageCircle}
            title="Aún no hay mensajes"
            description={
              direccion === "out"
                ? "Los mensajes enviados por WhatsApp aparecerán aquí."
                : "Cuando un paciente escriba a tu número de WhatsApp, sus mensajes aparecerán aquí."
            }
          />
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sentido</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Mensaje</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Momento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <Badge variant={f.direction === "in" ? "blue" : "teal"}>
                      {f.direction === "in" ? "Entrante" : "Saliente"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {f.patientNombre ? (
                      <span className="text-sm font-medium">{f.patientNombre}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                    {f.phoneNumber ?? f.waId ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[320px]">
                    <p className="whitespace-pre-wrap text-sm" title={f.body ?? undefined}>
                      {f.body ? (f.body.length > 140 ? `${f.body.slice(0, 140)}…` : f.body) : "—"}
                    </p>
                  </TableCell>
                  <TableCell>
                    {f.error ? (
                      <Badge variant="red" title={f.error}>
                        Error
                      </Badge>
                    ) : (
                      <Badge variant="green">{f.estado}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    <span title={format(f.createdAt, "d MMM yyyy HH:mm")}>
                      {formatDistanceToNow(f.createdAt, { addSuffix: true, locale: es })}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(anterior !== null || siguiente !== null) && (
            <div className="flex items-center justify-between border-t p-3">
              <span className="text-xs tabular-nums text-muted-foreground">
                {offset + 1}–{Math.min(offset + LIMITE, total)} de {total}
              </span>
              <div className="flex gap-2">
                {anterior !== null ? (
                  <Link
                    href={hrefPage(anterior)}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
                  >
                    Anteriores
                  </Link>
                ) : null}
                {siguiente !== null ? (
                  <Link
                    href={hrefPage(siguiente)}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
                  >
                    Siguientes
                  </Link>
                ) : null}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
