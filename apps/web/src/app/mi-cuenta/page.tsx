import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AtSign, KeyRound, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getSession, getPlatformSession } from "@/lib/auth";
import { CambiarCorreoForm, CambiarContrasenaForm } from "./mi-cuenta-forms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mi cuenta — Odontoflow",
};

export default async function MiCuentaPage() {
  const staff = await getSession();
  const platform = staff ? null : await getPlatformSession();
  const sesion = staff ?? platform;
  if (!sesion) redirect("/login");
  if (sesion.mustChangePassword) redirect("/primer-acceso");

  const esConsola = Boolean(staff);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <Link
          href={esConsola ? "/consola" : "/admin/resumen"}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">Mi cuenta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{sesion.name}</span> ·{" "}
          <span className="font-medium text-foreground">{sesion.email}</span>
          {esConsola ? " · acceso al consultorio" : " · acceso de plataforma"}
        </p>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <AtSign className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">Correo de acceso</p>
              <p className="text-xs text-muted-foreground">
                Aquí llegan los correos de recuperación. Cámbialo si dejas de
                usar el actual.
              </p>
            </div>
          </div>
          <div className="mt-5">
            <CambiarCorreoForm emailActual={sesion.email} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <KeyRound className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">Contraseña</p>
              <p className="text-xs text-muted-foreground">
                Al cambiarla se cierran tus otras sesiones activas.
              </p>
            </div>
          </div>
          <div className="mt-5">
            <CambiarContrasenaForm />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
