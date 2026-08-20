import { Search, ShieldCheck } from "lucide-react";
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
import { adminUsuarios } from "@/lib/console-data";
import { requirePlatformSession } from "@/lib/guard-sesion";

export const dynamic = "force-dynamic";

const ROL_LABEL: Record<string, string> = {
  owner: "Dueño/a",
  receptionist: "Recepción",
  doctor: "Odontólogo/a",
  assistant: "Asistente",
};

function paginaValida(valor: string | undefined): number {
  const n = Number(valor ?? "1");
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requirePlatformSession();

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = paginaValida(sp.page);
  const panel = await adminUsuarios({ q, page, perPage: 50 });

  const hrefCon = (overrides: Record<string, string | null>) => {
    const valores: Record<string, string | null> = { q: q || null, ...overrides };
    const nsp = new URLSearchParams();
    for (const [k, v] of Object.entries(valores)) {
      if (v) nsp.set(k, v);
    }
    const s = nsp.toString();
    return s ? `/admin/usuarios?${s}` : "/admin/usuarios";
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Usuarios"
        description="Búsqueda global de cuentas en toda la red. Las acciones de soporte se hacen desde la ficha del tenant."
      />

      <form key={q} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="q" className="text-xs font-medium text-muted-foreground">Buscar</label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Nombre o email…"
            className="flex h-9 w-72 rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Search className="size-4" />
          Buscar
        </button>
        {q ? (
          <Link
            href="/admin/usuarios"
            className="inline-flex h-9 items-center rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Limpiar
          </Link>
        ) : null}
      </form>

      <Card>
        <CardContent className="p-0">
          {panel.usuarios.length === 0 ? (
            <EmptyState
              icon={Search}
              title={q ? "Sin resultados" : "Sin usuarios"}
              description={q ? `Nada coincide con “${q}”.` : "Todavía no hay cuentas creadas."}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Tenant / rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acceso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {panel.usuarios.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </TableCell>
                    <TableCell>
                      {u.isPlatformAdmin ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <ShieldCheck className="size-3.5 text-violet-600" />
                          Plataforma
                        </span>
                      ) : u.tenantNombre ? (
                        <span className="text-sm">
                          <Link
                            href={`/admin/tenants/${u.tenantId}`}
                            className="underline-offset-2 hover:underline"
                          >
                            {u.tenantNombre}
                          </Link>
                          {u.role ? (
                            <span className="text-xs text-muted-foreground">
                              {" "}
                              · {ROL_LABEL[u.role] ?? u.role}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <Badge variant="gray">Sin tenant</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.lockedAt ? (
                        <Badge variant="amber">Bloqueado</Badge>
                      ) : u.membActive === false ? (
                        <Badge variant="red">Membresía inactiva</Badge>
                      ) : (
                        <Badge variant="green">Activo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                      {u.tenantId ? (
                        <Link
                          href={`/admin/tenants/${u.tenantId}`}
                          className="underline-offset-2 hover:underline"
                        >
                          Ver en tenant
                        </Link>
                      ) : (
                        "—"
                      )}
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
              Página {panel.page} de {panel.pages} · {panel.total} usuarios
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
