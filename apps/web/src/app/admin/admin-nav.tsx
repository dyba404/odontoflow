"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  History,
  LayoutDashboard,
  Users,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin/resumen", label: "Resumen", icon: LayoutDashboard },
  { href: "/admin/tenants", label: "Tenants", icon: Building2 },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/auditoria", label: "AuditorA-a", icon: History },
  { href: "/mi-cuenta", label: "Mi cuenta", icon: UserCog },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col">
      {NAV.map((item) => {
        const activo = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              activo
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
