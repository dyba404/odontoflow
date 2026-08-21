"use client";

import { useEffect, useState } from "react";
import { Loader2, Wallet } from "lucide-react";

type Row = {
  id: string;
  quoteId: string | null;
  tituloPresupuesto: string | null;
  monto: number;
  kind: string;
  createdAt: string;
};

function fmtPEN(n: number): string {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);
}

export function AsignacionesPaciente({
  patientId,
  nombrePaciente,
}: {
  patientId: string;
  nombrePaciente: string;
}) {
  const [filas, setFilas] = useState<Row[] | null>(null);

  useEffect(() => {
    let activo = true;
    fetch(`/api/allocations?patient=${patientId}`)
      .then((r) => (r.ok ? r.json() : { allocations: [] }))
      .then((j) => {
        if (activo) setFilas((j.allocations ?? []) as Row[]);
      })
      .catch(() => {
        if (activo) setFilas([]);
      });
    return () => {
      activo = false;
    };
  }, [patientId]);

  if (filas === null) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Cargando pagos…
      </p>
    );
  }

  if (filas.length === 0) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Wallet className="size-4" /> Sin pagos asignados para {nombrePaciente}.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {filas.map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
          <span className="min-w-0">
            <span className="font-medium">{fmtPEN(a.monto)}</span>{" "}
            <span className="text-xs text-muted-foreground">
              {a.kind === "refund" ? "Reembolso" : "Asignado"}
              {a.tituloPresupuesto ? ` · ${a.tituloPresupuesto}` : " · a cuenta"}
            </span>
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {new Date(a.createdAt).toLocaleDateString("es-PE", { dateStyle: "medium" })}
          </span>
        </li>
      ))}
    </ul>
  );
}
