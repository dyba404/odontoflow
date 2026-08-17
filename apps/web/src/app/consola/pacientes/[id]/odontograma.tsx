"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type EstadoDiente = "sano" | "cariado" | "tratado" | "extraido" | "corona" | "ausente";

export type EstadoDienteInput = {
  toothFdi: number;
  estado: string;
  nota: string | null;
  updatedAt: string;
};

const ESTADOS: readonly EstadoDiente[] = [
  "sano",
  "cariado",
  "tratado",
  "corona",
  "extraido",
  "ausente",
];

const ESTADO_LABEL: Record<EstadoDiente, string> = {
  sano: "Sano",
  cariado: "Cariado",
  tratado: "Tratado",
  corona: "Corona",
  extraido: "Extraído",
  ausente: "Ausente",
};

const ESTADO_COLOR: Record<EstadoDiente, string> = {
  sano: "#a8a29e",
  cariado: "#d97706",
  tratado: "#0d9488",
  corona: "#7c3aed",
  extraido: "#78716c",
  ausente: "#ef4444",
};

const ESTADO_FILL: Record<EstadoDiente, string> = {
  sano: "none",
  cariado: "rgba(217, 119, 6, 0.2)",
  tratado: "rgba(13, 148, 136, 0.25)",
  corona: "rgba(124, 58, 237, 0.25)",
  extraido: "url(#odonto-hatch)",
  ausente: "none",
};

const SUPERIOR = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const INFERIOR = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const SIZE = 44;
const PITCH = 34;
const SECTION_GAP = 16;
const TOP_Y = 14;
const BOTTOM_Y = 148;
const CENTER_X = 288;

function slotX(slot: number): number {
  return 10 + slot * PITCH + Math.floor(slot / 8) * SECTION_GAP;
}

function Diente({
  fdi,
  x0,
  y0,
  estado,
  canEdit,
  onSelect,
}: {
  fdi: number;
  x0: number;
  y0: number;
  estado: EstadoDiente;
  canEdit: boolean;
  onSelect: (fdi: number, r: DOMRect) => void;
}) {
  const x1 = x0 + SIZE;
  const y1 = y0 + SIZE;
  const mx = x0 + SIZE / 2;
  const my = y0 + SIZE / 2;
  const color = ESTADO_COLOR[estado];
  return (
    <g
      className={canEdit ? "cursor-pointer" : undefined}
      onClick={
        canEdit
          ? (e) => {
              e.stopPropagation();
              onSelect(fdi, e.currentTarget.getBoundingClientRect());
            }
          : undefined
      }
    >
      <title>{`Diente ${fdi} · ${ESTADO_LABEL[estado]}`}</title>
      <rect x={x0} y={y0} width={SIZE} height={SIZE} rx={2} fill={ESTADO_FILL[estado]} stroke={color} strokeWidth={1.4} />
      <path
        d={`M ${mx} ${y0} L ${x1} ${my} L ${mx} ${y1} L ${x0} ${my} Z`}
        fill="none"
        stroke={color}
        strokeWidth={1}
        opacity={0.85}
      />
      <path
        d={`M ${x0} ${y0} L ${(x0 + mx) / 2} ${(y0 + my) / 2} M ${x1} ${y0} L ${(x1 + mx) / 2} ${(y0 + my) / 2} M ${x1} ${y1} L ${(x1 + mx) / 2} ${(y1 + my) / 2} M ${x0} ${y1} L ${(x0 + mx) / 2} ${(y1 + my) / 2}`}
        fill="none"
        stroke={color}
        strokeWidth={1}
        opacity={0.85}
      />
      {estado === "ausente" ? (
        <path
          d={`M ${x0 + 5} ${y0 + 5} L ${x1 - 5} ${y1 - 5} M ${x1 - 5} ${y0 + 5} L ${x0 + 5} ${y1 - 5}`}
          stroke={color}
          strokeWidth={2.4}
          strokeLinecap="round"
          fill="none"
        />
      ) : null}
      <text x={mx} y={y1 + 13} textAnchor="middle" fontSize={9} fill="#78716c">
        {fdi}
      </text>
    </g>
  );
}

export function Odontograma({
  estados,
  canEdit,
  patientId,
}: {
  estados: EstadoDienteInput[];
  canEdit: boolean;
  patientId: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [mapa, setMapa] = useState<Record<number, EstadoDienteInput>>(() =>
    Object.fromEntries(estados.map((e) => [e.toothFdi, e])),
  );
  const [sel, setSel] = useState<{
    tooth: number;
    left: number;
    top: number;
    estado: EstadoDiente;
    nota: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!sel) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSel(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel]);

  function estadoDe(fdi: number): EstadoDiente {
    const v = mapa[fdi]?.estado as EstadoDiente | undefined;
    return v && ESTADOS.includes(v) ? v : "sano";
  }

  function onSelect(fdi: number, r: DOMRect) {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const wr = wrapper.getBoundingClientRect();
    const left = Math.min(Math.max(r.left - wr.left + r.width / 2, 120), Math.max(wr.width - 120, 120));
    const top = r.bottom - wr.top + 8;
    setSel({ tooth: fdi, left, top, estado: estadoDe(fdi), nota: mapa[fdi]?.nota ?? "" });
  }

  async function guardar() {
    if (!sel) return;
    setSaving(true);
    const { tooth, estado, nota } = sel;
    try {
      const r = await fetch(`/api/pacientes/${patientId}/dientes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toothFdi: tooth, estado, nota: nota.trim() || null }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        toast.error(`No se pudo guardar el diente ${tooth}: ${j.error ?? "error"}`);
        return;
      }
      setMapa((prev) => ({
        ...prev,
        [tooth]: {
          toothFdi: tooth,
          estado,
          nota: nota.trim() || null,
          updatedAt: new Date().toISOString(),
        },
      }));
      toast.success(`Diente ${tooth}: ${ESTADO_LABEL[estado]}`);
      setSel(null);
    } catch {
      toast.error("No se pudo guardar el diente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <svg viewBox="0 0 586 212" className="w-full" role="img" aria-label="Odontograma FDI">
        <defs>
          <pattern
            id="odonto-hatch"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill="#f5f5f4" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#a8a29e" strokeWidth="2" />
          </pattern>
        </defs>
        <line
          x1={CENTER_X}
          y1={TOP_Y - 6}
          x2={CENTER_X}
          y2={BOTTOM_Y + SIZE + 6}
          stroke="#d6d3d1"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        {SUPERIOR.map((fdi, slot) => (
          <Diente
            key={fdi}
            fdi={fdi}
            x0={slotX(slot)}
            y0={TOP_Y}
            estado={estadoDe(fdi)}
            canEdit={canEdit}
            onSelect={onSelect}
          />
        ))}
        {INFERIOR.map((fdi, slot) => (
          <Diente
            key={fdi}
            fdi={fdi}
            x0={slotX(slot)}
            y0={BOTTOM_Y}
            estado={estadoDe(fdi)}
            canEdit={canEdit}
            onSelect={onSelect}
          />
        ))}
      </svg>

      {canEdit && sel ? (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setSel(null)} />
          <div
            className="absolute z-30 w-60 -translate-x-1/2 space-y-2.5 rounded-xl border bg-card p-3 shadow-lg"
            style={{ left: sel.left, top: sel.top }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Diente {sel.tooth}</p>
              <button
                type="button"
                aria-label="Cerrar"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setSel(null)}
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="diente-estado">
                Estado
              </label>
              <Select
                id="diente-estado"
                className="h-8 text-xs"
                value={sel.estado}
                onChange={(e) => setSel({ ...sel, estado: e.target.value as EstadoDiente })}
              >
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>
                    {ESTADO_LABEL[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="diente-nota">
                Nota (opcional)
              </label>
              <Input
                id="diente-nota"
                className="h-8 text-xs"
                placeholder="Observación clínica…"
                value={sel.nota}
                onChange={(e) => setSel({ ...sel, nota: e.target.value })}
              />
            </div>
            <Button size="sm" className="w-full" disabled={saving} onClick={guardar}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
