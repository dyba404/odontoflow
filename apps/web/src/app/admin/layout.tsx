import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getPlatformSession } from "@/lib/auth";
import { AdminNav } from "@/app/admin/admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPlatformSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/primer-acceso");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="shrink-0 border-b border-border bg-card lg:w-56 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-5 py-4 lg:py-6">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <ShieldCheck className="size-4 text-primary-foreground" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Panel plataforma</p>
            <p className="truncate text-xs text-muted-foreground">{session.email}</p>
          </div>
        </div>
        <AdminNav />
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
