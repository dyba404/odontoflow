"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const RANGOS = [
  { value: "mes_actual", label: "Este mes" },
  { value: "mes_pasado", label: "Mes pasado" },
  { value: "ultimos_30", label: "Últimos 30 días" },
];

function formatoLocal(d: Date): string {
  // TZ fija Lima: el rango se calcula igual en SSR e hidratación (evita #418)
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

function rangoActual(opcion: string): { desde: string; hasta: string } {
  const hoy = new Date();
  const partes = formatoLocal(hoy).split("-").map(Number);
  const [ly = 0, lm = 1, ld = 1] = partes;
  if (opcion === "mes_actual") {
    return { desde: `${ly}-${String(lm).padStart(2, "0")}-01`, hasta: formatoLocal(hoy) };
  }
  if (opcion === "mes_pasado") {
    const y2 = lm === 1 ? ly - 1 : ly;
    const m2 = lm === 1 ? 12 : lm - 1;
    const fin = new Date(hoy.getTime() - ld * 86400000); // último día del mes previo (Lima)
    return { desde: `${y2}-${String(m2).padStart(2, "0")}-01`, hasta: formatoLocal(fin) };
  }
  const inicio = new Date(hoy.getTime() - 29 * 86400000);
  return { desde: formatoLocal(inicio), hasta: formatoLocal(hoy) };
}

export function ExportSunatButton() {
  const [opcion, setOpcion] = useState("mes_actual");
  const { desde, hasta } = rangoActual(opcion);

  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <Select
        aria-label="Rango del reporte"
        value={opcion}
        onChange={(e) => setOpcion(e.target.value)}
        className="h-8 flex-1 text-xs sm:w-40 sm:flex-none"
      >
        {RANGOS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </Select>
      <a
        href={`/api/export/sunat?desde=${desde}&hasta=${hasta}`}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1 sm:flex-none")}
      >
        <Download className="size-3.5" />
        Exportar SUNAT
      </a>
    </div>
  );
}
