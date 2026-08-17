export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={`kpi-${i}`}
          className="flex min-h-[110px] flex-col justify-between rounded-2xl border bg-card p-5"
        >
          <div className="h-3.5 w-20 animate-pulse rounded-full bg-muted" />
          <div className="mt-3 h-7 w-28 animate-pulse rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={`row-${i}`}
          className="h-12 animate-pulse rounded-lg bg-muted"
        />
      ))}
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-4">
        <div className="h-9 w-72 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-full bg-muted" />
      </div>
      <KpiSkeleton />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-2xl border bg-card p-5 lg:col-span-3">
          <ListSkeleton rows={6} />
        </div>
        <div className="rounded-2xl border bg-card p-5 lg:col-span-2">
          <ListSkeleton rows={4} />
        </div>
      </div>
    </div>
  );
}
