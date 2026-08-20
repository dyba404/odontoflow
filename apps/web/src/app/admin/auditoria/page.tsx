import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { History, X } from "lucide-react";
import Link from "next/link";
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
import { auditoriaSoporte } from "@/lib/console-data";
import { requirePlatformSession } from "@/lib/guard-sesion";

export const dynamic = "force-dynamic";

function paginaValida(valor: string | undefined): number {
  const n = Number(valor ?? "1");
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export default async function AdminAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ accion?: string; page?: string }>;
}) {
  await requirePlatformSession();

  const sp = await searchParams;
  const accion = sp.accion?.trim() ?? "";
  const page = paginaValida(sp.page);
  const data = await auditoriaSoporte({ accion, page, perPage: 50 });

  const hrefCon = (overrides: Record<string, string | null>) => {
    const valores: Record<string, string | null> = { accion: accion || null, ...overrides };
    const nsp = new URLSearchParams();
    for (const [k, v] of Object.entries(valores)) {
      if (v) nsp.set(k, v);
    }
    const s = nsp.toString();
    return s ? `/admin/auditoria?${s}` : "/admin/auditoria";
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Auditoría de soporte"
        description="Todas las acciones del equipo de plataforma sobre cualquier tenant (eventos soporte.*)."
      />

      <form key={accion} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="accion" className="text-xs font-medium text-muted-foreground">Acción</label>
          <select
            id="accion"
            name="accion"
            defaultValue={accion}
            className="flex h-9 w-64 rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Todas</option>
            {data.acciones.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filtrar
        </button>
        {accion ? (
          <Link
            href="/admin/auditoria"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            <X className="size-4" />
            Limpiar
          </Link>
        ) : null}
      </form>

      {data.filas.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title={accion ? "Sin resultados para esa acción" : "Sin acciones de soporte"}
            description="Cambios de plan, bloqueos, desbloqueos, recuperaciones y membresías aparecerán aquí."
          />
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Acción</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Momento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.filas.map((fila) => {
                const p = (fila.payload ?? {}) as Record<string, unknown>;
                const adminEmail = typeof p.adminEmail === "string" ? p.adminEmail : null;
                return (
                  <TableRow key={fila.id}>
                    <TableCell>
                      <Badge variant="secondary">{fila.accion}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/tenants/${fila.tenantId}`}
                        className="text-sm underline-offset-2 hover:underline"
                      >
                        {fila.tenantNombre}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          typeof p.plan === "string" ? `plan: ${p.plan}` : null,
                          typeof p.estado === "string" ? `estado: ${p.estado}` : null,
                          typeof p.motivo === "string" ? `motivo: ${p.motivo}` : null,
                          typeof p.email === "string" ? p.email : null,
                          typeof p.afectadas === "number" ? `${p.afectadas} membresías` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </TableCell>
                    <TableCell>{adminEmail ?? fila.userName ?? "—"}</TableCell>
                    <TableCell className="tabular-nums text-xs text-muted-foreground">
                      {formatDistanceToNow(fila.createdAt, { addSuffix: true, locale: es })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {(data.page > 1 || data.page < data.pages) && (
            <div className="flex items-center justify-between border-t p-3">
              <span className="text-xs tabular-nums text-muted-foreground">
                Página {data.page} de {data.pages} · {data.total} eventos
              </span>
              <div className="flex gap-2">
                {data.page > 1 ? (
                  <Link
                    href={hrefCon({ page: String(data.page - 1) })}
                    className="inline-flex h-8 items-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
                  >
                    Anteriores
                  </Link>
                ) : null}
                {data.page < data.pages ? (
                  <Link
                    href={hrefCon({ page: String(data.page + 1) })}
                    className="inline-flex h-8 items-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
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
