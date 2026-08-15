"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function BotonConfirmar({ citaId }: { citaId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function confirmar() {
    setError(null);
    startTransition(async () => {
      const r = await fetch(`/api/solicitudes/${citaId}/confirmar`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "error_confirmar");
        return;
      }
      setOk(true);
      setTimeout(() => router.refresh(), 600);
    });
  }

  if (ok) {
    return <span style={{ color: "var(--of-primary)", fontWeight: 600, fontSize: "0.875rem" }}>Confirmada</span>;
  }

  return (
    <button
      onClick={confirmar}
      disabled={pending}
      title={error ?? undefined}
      style={{
        background: "var(--of-primary)",
        color: "var(--of-on-primary)",
        border: "none",
        borderRadius: "var(--of-radius)",
        padding: "0.4rem 0.75rem",
        fontWeight: 600,
        fontSize: "0.8125rem",
        cursor: pending ? "wait" : "pointer",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? "..." : "Confirmar"}
    </button>
  );
}
