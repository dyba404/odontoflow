import { desc } from "drizzle-orm";
import { infraBackups, type OdontoflowDb } from "@odontoflow/db";
import { ArrowUpToLine, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Tarjeta "Salud de la infraestructura": última ejecución de cada respaldo
// registrado en infra_backups (ver docker/cron/*.sh y /api/cron/backup-log).
// Es un Server Component asíncrono renderizado dentro de /admin/resumen.

const KINDS: { kind: string; label: string }[] = [
  { kind: "pg_dump", label: "Volcado Postgres" },
  { kind: "adjuntos", label: "Adjuntos de pacientes" },
  { kind: "fiscal", label: "Comprobantes SUNAT" },
  { kind: "rclone", label: "Subida externa (off-site)" },
];

function hace(millis: number): string {
  const minutos = Math.max(1, Math.round(millis / 60_000));
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 48) return `hace ${horas} h`;
  return `hace ${Math.round(horas / 24)} d`;
}

function bytesHumanos(b: number | null): string | null {
  if (b == null) return null;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export async function InfraHealthCard({ db }: { db: OdontoflowDb }) {
  const ahora = Date.now();

  const ultimos = await db
    .select()
    .from(infraBackups)
    .orderBy(desc(infraBackups.id))
    .limit(200);

  const porKind = new Map(KINDS.map(({ kind }) => [kind, ultimos.find((r) => r.kind === kind)]));

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <ArrowUpToLine className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Salud de la infraestructura</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Última ejecución registrada de cada respaldo diario (infra_backups).
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {KINDS.map(({ kind, label }) => {
            const r = porKind.get(kind);
            const ok = r?.status === "ok";
            const omitido = r?.status === "omitido";
            return (
              <div
                key={kind}
                className={cn(
                  "rounded-lg border p-3",
                  ok && "border-green-200 bg-green-50",
                  omitido && "border-amber-200 bg-amber-50",
                  !r && "border-gray-200 bg-gray-50",
                )}
              >
                <p className="text-sm font-medium">{label}</p>
                {r ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5" />
                    {hace(ahora - r.createdAt.getTime())}
                    {r.sizeBytes ? ` · ${bytesHumanos(r.sizeBytes)}` : ""}
                    {r.detail ? ` · ${r.detail}` : ""}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sin registros todavía (primer respaldo programado esta noche)
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {ultimos.length === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Se verá la primera fila tras el próximo respaldo nocturno (pg_dump 3:40, off-site 4:00).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
