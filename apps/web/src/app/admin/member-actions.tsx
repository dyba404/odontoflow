"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, KeyRound, MailCheck, Unlock, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export interface Miembro {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  lockedAt: string | null;
  isPlatformAdmin: boolean;
  ultimaSesion: string | null;
}

export function MemberActions({
  tenantId,
  miembro,
  onChanged,
}: {
  tenantId: string;
  miembro: Miembro;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dialogo, setDialogo] = useState<"bloquear" | "desactivar" | null>(null);
  const [motivo, setMotivo] = useState("");

  const bloqueado = Boolean(miembro.lockedAt);

  async function post(url: string, body?: unknown): Promise<Record<string, unknown> | null> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(`${j.error ?? "error"}`);
      return null;
    }
    onChanged();
    router.refresh();
    return j;
  }

  function confirmarBloqueo() {
    start(async () => {
      const j = await post(`/api/admin/users/${miembro.userId}/lock`, { reason: motivo.trim() });
      if (j) {
        toast.success(`Usuario bloqueado: ${miembro.email}`);
        setDialogo(null);
        setMotivo("");
      }
    });
  }

  function confirmarDesactivar() {
    start(async () => {
      const res = await fetch(`/api/admin/memberships/${miembro.membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false, nota: motivo.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`${j.error ?? "error"}`);
        return;
      }
      toast.success(`Membresía desactivada: ${miembro.email}`);
      setDialogo(null);
      setMotivo("");
      onChanged();
      router.refresh();
    });
  }

  function activar() {
    start(async () => {
      const res = await fetch(`/api/admin/memberships/${miembro.membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`${j.error ?? "error"}`);
        return;
      }
      toast.success(`Membresía activada: ${miembro.email}`);
      window.dispatchEvent(new Event("of-miembros-cambiados"));
      onChanged();
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const j = await post("/api/admin/password-reset", { userId: miembro.userId });
              if (j) toast.success(`Recuperación enviada a ${miembro.email}`);
            })
          }
        >
          <MailCheck className="size-3.5" />
          Recuperación
        </Button>

        {!miembro.isPlatformAdmin &&
          (bloqueado ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const j = await post(`/api/admin/users/${miembro.userId}/unlock`);
                  if (j) toast.success(`Usuario desbloqueado: ${miembro.email}`);
                })
              }
            >
              <Unlock className="size-3.5" />
              Desbloquear
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setDialogo("bloquear")}
            >
              <Ban className="size-3.5" />
              Bloquear
            </Button>
          ))}

        {miembro.active ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setDialogo("desactivar")}
          >
            <UserRoundX className="size-3.5" />
            Desactivar
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled={pending} onClick={activar}>
            <UserRoundX className="size-3.5" />
            Activar
          </Button>
        )}

        {!miembro.isPlatformAdmin && !bloqueado && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await fetch("/api/admin/impersonate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId: miembro.userId, tenantId }),
                });
                const j = await res.json().catch(() => ({}));
                if (!res.ok || typeof j.url !== "string") {
                  toast.error(`No se pudo impersonar: ${j.error ?? "error"}`);
                  return;
                }
                window.location.assign(j.url);
              })
            }
          >
            <KeyRound className="size-3.5" />
            Impersonar
          </Button>
        )}

        {!miembro.isPlatformAdmin && bloqueado && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Ban className="size-3.5" />
            Bloqueado
          </span>
        )}
      </div>

      <Dialog
        open={dialogo !== null}
        onClose={() => setDialogo(null)}
        title={dialogo === "bloquear" ? `Bloquear a ${miembro.name}` : `Desactivar membresía de ${miembro.name}`}
        description={
          dialogo === "bloquear"
            ? "Se cerrarán todas sus sesiones y no podrá loguearse hasta que lo desbloquees."
            : "Perderá el acceso a la consola de esta clínica."
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="motivo-miembro">Motivo (obligatorio)</Label>
          <Input
            id="motivo-miembro"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={200}
            placeholder="Ej. solicitud del doctor por licencia"
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setDialogo(null)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending || motivo.trim().length === 0}
            onClick={dialogo === "bloquear" ? confirmarBloqueo : confirmarDesactivar}
          >
            {pending ? "Aplicando…" : dialogo === "bloquear" ? "Bloquear" : "Desactivar"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
