import { Building2 } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { panelAdmin, planEstadoFacets } from "@/lib/console-data";
import { requirePlatformSession } from "@/lib/guard-sesion";

export const dynamic = "force-dynamic";

const ESTADO_LABEL: Record<string, string> = {
  activo: "Activo",
  por_renovar: "Por renovar",
  suspendido: "Suspendido",
  cancelado: "Cancelado",
};

const fmtVence = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function paginaValida(valor: string | undefined): number {
  const n = Number(valor ?? "1");
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export default async function AdminTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; plan?: string; estado?: string; page?: string }>;
}) {
  await requirePlatformSession();

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const plan = sp.plan ?? "";
  const estado = sp.estado ?? "";
  const page = paginaValida(sp.page);
  const [panel, facets] = await Promise.all([
    panelAdmin({ q, plan, estado, page, perPage: 25 }),
    planEstadoFacets(),
  ]);

  const hrefCon = (overrides: Record<string, string | null>) => {
    const valores: Record<string, string | null> = { q: q || null, plan: plan || null, estado: estado || null, ...overrides };
    const nsp = new URLSearchParams();
    for (const [k, v] of Object.entries(valores)) {
      if (v) nsp.set(k, v);
    }
    const s = nsp.toString();
    return s ? `/admin/tenants?${s}` : "/admin/tenants";
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Tenants"
        description="Clínicas de la red. Busca por nombre o slug y filtra por plan y estado."
      />

      <form key={`${q}|${plan}|${estado}`} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="q" className="text-xs font-medium text-muted-foreground">Buscar</label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Nombre o slug…"
            className="flex h-9 w-56 rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="plan" className="text-xs font-medium text-muted-foreground">Plan</label>
          <select
            id="plan"
            name="plan"
            defaultValue={plan}
            className="flex h-9 w-40 rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Todos</option>
            {facets.planes.map((f) => (
              <option key={f.plan} value={f.plan}>
                {f.plan === "free" ? "Free" : f.plan === "pro" ? "Pro" : f.plan === "premium" ? "Premium" : f.plan} ({f.total})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="estado" className="text-xs font-medium text-muted-foreground">Estado</label>
          <select
            id="estado"
            name="estado"
            defaultValue={estado}
            className="flex h-9 w-44 rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Todos</option>
            {facets.estados.map((f) => (
              <option key={f.estado} value={f.estado}>
                {ESTADO_LABEL[f.estado] ?? f.estado} ({f.total})
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
        {q || plan || estado ? (
          <Link
            href="/admin/tenants"
            className="inline-flex h-9 items-center rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Limpiar
          </Link>
        ) : null}
      </form>

      <Card>
        <CardContent className="p-0">
          {panel.tenants.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={q || plan || estado ? "Sin resultados para esos filtros" : "Sin tenants registrados"}
              description={
                q || plan || estado
                  ? "Ajusta la búsqueda o los filtros."
                  : "Todavía ninguna clínica usa Odontoflow."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clínica</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Miembros</TableHead>
                  <TableHead className="text-right">Pacientes</TableHead>
                  <TableHead className="text-right">Citas hoy</TableHead>
                  <TableHead className="text-right">Vence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {panel.tenants.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/admin/tenants/${t.id}`} className="block hover:underline underline-offset-2">
                        <p className="font-medium">{t.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{t.slug}</p>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {t.plan === "premium" ? (
                        <Badge variant="violet">Premium</Badge>
                      ) : t.plan === "pro" ? (
                        <Badge className="bg-primary/10 text-primary">Pro</Badge>
                      ) : (
                        <Badge variant="outline">Free</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <BadgeEstado estado={t.estado} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{t.miembros}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.pacientes}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.citasHoy}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                      {t.vence ? fmtVence.format(new Date(`${t.vence}T00:00:00`)) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {(panel.page > 1 || panel.page < panel.pages) && (
          <div className="flex items-center justify-between border-t p-3">
            <span className="text-xs tabular-nums text-muted-foreground">
              Página {panel.page} de {panel.pages} · {panel.total} tenants
            </span>
            <div className="flex gap-2">
              {panel.page > 1 ? (
                <Link
                  href={hrefCon({ page: String(panel.page - 1) })}
                  className="inline-flex h-8 items-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
                >
                  Anteriores
                </Link>
              ) : null}
              {panel.page < panel.pages ? (
                <Link
                  href={hrefCon({ page: String(panel.page + 1) })}
                  className="inline-flex h-8 items-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
                >
                  Siguientes
                </Link>
              ) : null}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function BadgeEstado({ estado }: { estado: string | null }) {
  const e = estado ?? "activo";
  if (e === "activo") return <Badge variant="green">Activo</Badge>;
  if (e === "por_renovar") return <Badge variant="amber">Por renovar</Badge>;
  if (e === "suspendido" || e === "cancelado") return <Badge variant="red">{ESTADO_LABEL[e]}</Badge>;
  return <Badge variant="gray">—</Badge>;
}
