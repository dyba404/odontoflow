"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function campos(e: FormEvent<HTMLFormElement>) {
  const f = e.currentTarget.elements;
  return {
    a: f.namedItem("a") as HTMLInputElement,
    b: f.namedItem("b") as HTMLInputElement,
    c: f.namedItem("c") as HTMLInputElement,
  };
}

export function CambiarCorreoForm({ emailActual }: { emailActual: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { a, b } = campos(e);
    const nuevo = a.value.trim();
    const contrasena = b.value;
    if (!nuevo || !contrasena) return;
    setPending(true);
    fetch("/api/auth/cambiar-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nuevo, contrasena }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "error");
        toast.success("Correo actualizado a " + j.email);
        (a as HTMLInputElement).value = "";
        (b as HTMLInputElement).value = "";
        router.refresh();
      })
      .catch((err: Error) => {
        const mapa: Record<string, string> = {
          email_ya_registrado: "Ese correo ya está en uso por otra cuenta",
          "contraseña_actual_invalida": "La contraseña no es correcta",
          email_invalido: "Ingresa un correo válido",
          email_igual: "Ese ya es tu correo actual",
        };
        toast.error(mapa[err.message] ?? "No se pudo cambiar el correo");
      })
      .finally(() => setPending(false));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium" htmlFor="mc-nuevo-email">
          Nuevo correo
        </label>
        <Input
          id="mc-nuevo-email"
          name="a"
          type="email"
          placeholder={emailActual}
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium" htmlFor="mc-email-pass">
          Tu contraseña actual (confirmación)
        </label>
        <Input
          id="mc-email-pass"
          name="b"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Guardando…" : "Cambiar correo"}
      </Button>
    </form>
  );
}

export function CambiarContrasenaForm() {
  const [pending, setPending] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { a, b, c } = campos(e);
    const actual = a.value;
    const nueva = b.value;
    if (nueva !== c.value) {
      toast.error("Las contraseñas nuevas no coinciden");
      return;
    }
    setPending(true);
    fetch("/api/auth/cambiar-contrasena", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actual, nueva }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "error");
        toast.success("Contraseña actualizada");
        (a as HTMLInputElement).value = "";
        (b as HTMLInputElement).value = "";
        (c as HTMLInputElement).value = "";
      })
      .catch((err: Error) => {
        const mapa: Record<string, string> = {
          "contraseña_actual_invalida": "La contraseña actual no es correcta",
          "contraseña_invalida": "La nueva debe tener al menos 8 caracteres y ser distinta",
        };
        toast.error(mapa[err.message] ?? "No se pudo cambiar la contraseña");
      })
      .finally(() => setPending(false));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium" htmlFor="mc-pass-actual">
          Contraseña actual
        </label>
        <Input id="mc-pass-actual" name="a" type="password" autoComplete="current-password" required />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium" htmlFor="mc-pass-nueva">
          Nueva contraseña (mínimo 8 caracteres)
        </label>
        <Input id="mc-pass-nueva" name="b" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium" htmlFor="mc-pass-confirmar">
          Repite la nueva contraseña
        </label>
        <Input id="mc-pass-confirmar" name="c" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Guardando…" : "Cambiar contraseña"}
      </Button>
    </form>
  );
}
