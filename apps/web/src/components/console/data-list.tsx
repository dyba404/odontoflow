import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Lista compacta estilo inventario: alternativa a <Table> donde las columnas
 * no caben (móvil/tablet). Cada fila es [título+meta] ... [dato][acciones].
 * Server-friendly: sin estado ni handlers propios.
 */
export function DataList({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("divide-y", className)}>{children}</div>;
}

export function DataRow({
  title,
  meta,
  leading,
  trailing,
  actions,
  muted,
}: {
  /** Línea principal (nombre/título de la entidad). Se trunca. */
  title: ReactNode;
  /** Subtexto pequeño bajo el título (método · hora · referencia…). Puede ser varios nodos. */
  meta?: ReactNode;
  /** Elemento inicial opcional (avatar, checkbox…). */
  leading?: ReactNode;
  /** Dato destacado a la derecha (monto, badge de estado…). */
  trailing?: ReactNode;
  /** Botones/acciones a la derecha del trailing. */
  actions?: ReactNode;
  /** Atenuar la fila (registros anulados/inactivos). */
  muted?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3 py-3", muted && "opacity-60")}>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        {meta ? <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{meta}</div> : null}
      </div>
      {trailing || actions ? (
        <div className="flex shrink-0 items-center gap-1.5">
          {trailing}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
